
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_WARNINGS = 4;

const WARNING_LEVELS = [
    {
        level: 1,
        emoji: '🟡',
        label: 'تنبيه رسمي',
        action: 'warning',
        durationMs: null,
    },
    {
        level: 2,
        emoji: '🟠',
        label: 'تايم أوت لمدة 6 ساعات',
        action: 'timeout',
        durationMs: 6 * 60 * 60 * 1000,
    },
    {
        level: 3,
        emoji: '🔴',
        label: 'تايم أوت لمدة 24 ساعة',
        action: 'timeout',
        durationMs: 24 * 60 * 60 * 1000,
    },
    {
        level: 4,
        emoji: '⛔',
        label: 'باند دائم',
        action: 'ban',
        durationMs: null,
    },
];

class ModerationService {
    constructor(manager, options = {}) {
        if (!manager) {
            throw new TypeError('ModerationService requires a protection manager.');
        }

        this.manager = manager;

        this.dataDir = options.dataDir
            || path.join(__dirname, '..', 'data');

        this.filePath = path.join(
            this.dataDir,
            'moderation.json'
        );

        this.data = null;
        this.writeQueue = Promise.resolve();
        this.locks = new Map();
    }

    createEmptyData() {
        return {
            version: 1,
            nextCaseId: 1,
            nextWarningId: 1,
            warnings: {},
            cases: {},
        };
    }

    async load() {
        if (this.data) {
            return this.data;
        }

        await fs.mkdir(this.dataDir, { recursive: true });

        try {
            const content = await fs.readFile(
                this.filePath,
                'utf8'
            );

            const parsed = JSON.parse(content);

            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                throw new TypeError(
                    'Invalid moderation database structure.'
                );
            }

            this.data = {
                ...this.createEmptyData(),
                ...parsed,
            };

        } catch (error) {
            if (error.code !== 'ENOENT') {
                if (
                    error instanceof SyntaxError ||
                    error instanceof TypeError
                ) {
                    const backupPath =
                        `${this.filePath}.corrupt-${Date.now()}`;

                    await fs.rename(
                        this.filePath,
                        backupPath
                    );

                    this.manager.logger.warn(
                        `Invalid moderation database backed up to ${backupPath}`
                    );

                } else {
                    throw error;
                }
            }

            this.data = this.createEmptyData();
            await this.persist();
        }

        if (
            !this.data.warnings ||
            typeof this.data.warnings !== 'object' ||
            Array.isArray(this.data.warnings)
        ) {
            this.data.warnings = {};
        }

        if (
            !this.data.cases ||
            typeof this.data.cases !== 'object' ||
            Array.isArray(this.data.cases)
        ) {
            this.data.cases = {};
        }

        if (!Number.isInteger(this.data.nextCaseId)) {
            this.data.nextCaseId = 1;
        }

        if (!Number.isInteger(this.data.nextWarningId)) {
            this.data.nextWarningId = 1;
        }

        return this.data;
    }

    async persist() {
        if (!this.data) {
            throw new Error(
                'Moderation data has not been loaded.'
            );
        }

        const snapshot = JSON.stringify(
            this.data,
            null,
            2
        );

        const write = async () => {
            await fs.mkdir(this.dataDir, {
                recursive: true,
            });

            const tempPath =
                `${this.filePath}.${process.pid}.${Date.now()}.tmp`;

            try {
                await fs.writeFile(
                    tempPath,
                    snapshot,
                    {
                        encoding: 'utf8',
                        mode: 0o600,
                    }
                );

                await fs.rename(
                    tempPath,
                    this.filePath
                );

            } catch (error) {
                await fs.unlink(tempPath).catch(() => {});
                throw error;
            }
        };

        this.writeQueue = this.writeQueue.then(
            write,
            write
        );

        return this.writeQueue;
    }

    async withLock(key, callback) {
        const previous =
            this.locks.get(key) || Promise.resolve();

        let release;

        const current = new Promise((resolve) => {
            release = resolve;
        });

        const tail = previous.then(() => current);

        this.locks.set(key, tail);

        await previous;

        try {
            return await callback();
        } finally {
            release();

            if (this.locks.get(key) === tail) {
                this.locks.delete(key);
            }
        }
    }

    normalizeReason(reason) {
        const result = String(
            reason || 'لم يُذكر سبب'
        ).trim();

        return result.slice(0, 500);
    }

    appendCase(guildId, entry) {
        const data = this.data;

        const caseEntry = {
            id: data.nextCaseId++,
            guildId,
            createdAt: new Date().toISOString(),
            ...entry,
        };

        if (!Array.isArray(data.cases[guildId])) {
            data.cases[guildId] = [];
        }

        data.cases[guildId].push(caseEntry);

        return caseEntry;
    }

    async recordCase(guildId, entry) {
        await this.load();

        return this.withLock(
            `cases:${guildId}`,
            async () => {
                const caseEntry = this.appendCase(
                    guildId,
                    {
                        ...entry,
                        reason: this.normalizeReason(
                            entry.reason
                        ),
                    }
                );

                await this.persist();

                return caseEntry;
            }
        );
    }

    async getCases(guildId, userId = null, limit = 10) {
        await this.load();

        const safeLimit = Math.max(
            1,
            Math.min(Number(limit) || 10, 50)
        );

        return (this.data.cases[guildId] || [])
            .filter((entry) => {
                return !userId ||
                    entry.targetId === userId;
            })
            .slice(-safeLimit)
            .reverse();
    }

    async getCase(guildId, caseId) {
        await this.load();

        return (this.data.cases[guildId] || [])
            .find((entry) => {
                return entry.id === Number(caseId);
            }) || null;
    }

    async getWarnings(guildId, userId) {
        await this.load();

        const guildWarnings =
            this.data.warnings[guildId] || {};

        const warnings =
            guildWarnings[userId] || [];

        return [...warnings];
    }

    async warn(interaction, member, reason) {
        if (!interaction.guild || !member) {
            return {
                ok: false,
                message: 'هذا الأمر متاح داخل السيرفر فقط.',
            };
        }

        const guild = interaction.guild;
        const guildId = guild.id;
        const userId = member.id;

        return this.withLock(
            `warnings:${guildId}:${userId}`,
            async () => {
                await this.load();

                const guildWarnings =
                    this.data.warnings[guildId] ||= {};

                const warnings =
                    guildWarnings[userId] ||= [];

                if (warnings.length >= MAX_WARNINGS) {
                    return {
                        ok: false,
                        message:
                            'وصل العضو إلى الحد الأقصى للتحذيرات. راجع سجل العقوبات.',
                    };
                }

                const level = warnings.length + 1;
                const rule = WARNING_LEVELS[level - 1];
                const safeReason =
                    this.normalizeReason(reason);

                let punishmentApplied = true;

                if (rule.action === 'timeout') {
                    punishmentApplied =
                        await this.manager.punishments.timeout(
                            member,
                            rule.durationMs,
                            `تحذير رقم ${level}: ${safeReason}`
                        );

                } else if (rule.action === 'ban') {
                    try {
                        if (!member.bannable) {
                            punishmentApplied = false;
                        } else {
                            await guild.members.ban(
                                userId,
                                {
                                    reason:
                                        `التحذير الرابع: ${safeReason}`,
                                }
                            );
                        }
                    } catch (error) {
                        punishmentApplied = false;

                        this.manager.logger.warn(
                            'Could not apply warning escalation ban.',
                            error
                        );
                    }
                }

                if (!punishmentApplied) {
                    return {
                        ok: false,
                        message:
                            'تعذّر تطبيق العقوبة. تحقق من صلاحيات البوت وترتيب الرتب. لم يُسجّل التحذير.',
                    };
                }

                const warning = {
                    id: this.data.nextWarningId++,
                    level,
                    reason: safeReason,
                    moderatorId: interaction.user.id,
                    createdAt: new Date().toISOString(),
                };

                warnings.push(warning);

                const caseEntry = this.appendCase(
                    guildId,
                    {
                        type: rule.action === 'ban'
                            ? 'ban'
                            : rule.action === 'timeout'
                                ? 'timeout'
                                : 'warn',

                        targetId: userId,
                        moderatorId: interaction.user.id,
                        reason: safeReason,
                        warningId: warning.id,
                        warningLevel: level,
                        durationMs: rule.durationMs,
                    }
                );

                await this.persist();

                await this.manager.log(
                    guild,
                    `${rule.emoji} ${rule.label}`,
                    [
                        `العضو: <@${userId}>`,
                        `المشرف: <@${interaction.user.id}>`,
                        `السبب: ${safeReason}`,
                        `التحذير: ${level}/${MAX_WARNINGS}`,
                        `القضية: #${caseEntry.id}`,
                    ].join('\n')
                );

                return {
                    ok: true,
                    warning,
                    rule,
                    caseEntry,
                    activeWarnings: warnings.length,
                };
            }
        );
    }

    async removeWarning(
        guildId,
        userId,
        warningId,
        moderatorId
    ) {
        await this.load();

        return this.withLock(
            `warnings:${guildId}:${userId}`,
            async () => {
                const warnings =
                    this.data.warnings[guildId]?.[userId];

                if (!Array.isArray(warnings) || !warnings.length) {
                    return null;
                }

                const index = warnings.findIndex(
                    (warning) =>
                        warning.id === Number(warningId)
                );

                if (index === -1) {
                    return null;
                }

                const [removed] = warnings.splice(index, 1);

                const caseEntry = this.appendCase(
                    guildId,
                    {
                        type: 'unwarn',
                        targetId: userId,
                        moderatorId: moderatorId || null,
                        reason:
                            `إزالة التحذير رقم ${removed.id}`,
                        removedWarning: removed,
                    }
                );

                await this.persist();

                return {
                    warning: removed,
                    caseEntry,
                };
            }
        );
    }

    async clearWarnings(
        guildId,
        userId,
        moderatorId
    ) {
        await this.load();

        return this.withLock(
            `warnings:${guildId}:${userId}`,
            async () => {
                const warnings =
                    this.data.warnings[guildId]?.[userId];

                const count = Array.isArray(warnings)
                    ? warnings.length
                    : 0;

                if (!count) {
                    return 0;
                }

                this.data.warnings[guildId][userId] = [];

                this.appendCase(
                    guildId,
                    {
                        type: 'clear-warnings',
                        targetId: userId,
                        moderatorId,
                        reason: `مسح ${count} تحذير`,
                    }
                );

                await this.persist();

                return count;
            }
        );
    }
}

module.exports = {
    ModerationService,
    WARNING_LEVELS,
    MAX_WARNINGS,
};
