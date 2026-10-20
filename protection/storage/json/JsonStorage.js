
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { StorageAdapter } = require('../StorageAdapter');

class JsonStorage extends StorageAdapter {
    constructor(dataDir) {
        super();

        this.dataDir =
            dataDir || path.join(__dirname, '..', '..', 'data');

        this.filePath = path.join(
            this.dataDir,
            'guild-configs.json'
        );

        this.cache = null;
        this.writeQueue = Promise.resolve();
    }

    async load() {
        if (this.cache !== null) {
            return this.cache;
        }

        await fs.mkdir(this.dataDir, { recursive: true });

        try {
            const raw = await fs.readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);

            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                throw new TypeError(
                    'Security config storage must contain a JSON object.'
                );
            }

            this.cache = parsed;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                if (
                    error instanceof SyntaxError ||
                    error instanceof TypeError
                ) {
                    const recoveryPath =
                        `${this.filePath}.corrupt-${Date.now()}`;

                    await fs.rename(
                        this.filePath,
                        recoveryPath
                    );

                    console.error(
                        '[Protection Storage] Invalid JSON preserved at:',
                        recoveryPath
                    );
                } else {
                    throw error;
                }
            }

            this.cache = {};
            await this.persist();
        }

        return this.cache;
    }

    async get(guildId) {
        const data = await this.load();

        return Object.prototype.hasOwnProperty.call(data, guildId)
            ? structuredClone(data[guildId])
            : null;
    }

    async getAll() {
        return structuredClone(await this.load());
    }

    async set(guildId, value) {
        const data = await this.load();

        data[guildId] = structuredClone(value);

        await this.persist();
    }

    async delete(guildId) {
        const data = await this.load();

        delete data[guildId];

        await this.persist();
    }

    async persist() {
        const task = async () => {
            await fs.mkdir(this.dataDir, { recursive: true });

            const tempPath =
                `${this.filePath}.${process.pid}.` +
                `${Date.now()}.` +
                `${Math.random().toString(16).slice(2)}.tmp`;

            try {
                const snapshot = JSON.stringify(
                    this.cache ?? {},
                    null,
                    2
                );

                await fs.writeFile(tempPath, snapshot, 'utf8');

                await fs.rename(tempPath, this.filePath);
            } catch (error) {
                await fs.unlink(tempPath).catch(() => {});
                throw error;
            }
        };

        this.writeQueue = this.writeQueue.then(task, task);

        return this.writeQueue;
    }
}

module.exports = { JsonStorage };
