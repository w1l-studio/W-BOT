'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_CONFIG } = require('../config');
const { JsonStorage } = require('../storage/json/JsonStorage');
const { IncidentService } = require('../services/incidentService');
const { normalize } = require('../modules/antiSpam');
const { extractHosts, isAllowedHost } = require('../modules/antiLink');
const { detectBurst } = require('../modules/antiNuke/detector');

async function main() {
  assert.equal(DEFAULT_CONFIG.operatingMode, 'monitor', 'must start in safe monitor mode');
  assert.equal(DEFAULT_CONFIG.antiLink.enabled, false, 'link deletion must be opt-in');
  assert.equal(normalize('  HELLO\n   world  '), 'hello world');

  const hosts = extractHosts('Visit https://sub.example.com/path and https://evil.test/a');
  assert.deepEqual(hosts, ['sub.example.com', 'evil.test']);
  assert.equal(isAllowedHost(['sub.example.com'], ['example.com']), true, 'subdomains of allowlisted domains are permitted');
  assert.equal(isAllowedHost(hosts, ['example.com']), false, 'an allowlisted link must not excuse a second untrusted domain');

  const key = 'guild:actor';
  const detectorManager = { nukeWindows: new Map(), nukeCooldowns: new Map() };
  const detectorConfig = { windowMs: 10_000, maxActions: 3, cooldownMs: 2_000 };
  assert.equal(detectBurst(detectorManager, 'guild', 'actor', 'RoleUpdate', 'role-1', detectorConfig).triggered, false);
  assert.equal(detectBurst(detectorManager, 'guild', 'actor', 'RoleDelete', 'role-2', detectorConfig).triggered, false);
  assert.equal(detectBurst(detectorManager, 'guild', 'actor', 'ChannelDelete', 'channel-1', detectorConfig).triggered, true);
  assert.equal(detectorManager.nukeWindows.has(key), false, 'triggered windows are reset');
  assert.equal(detectBurst(detectorManager, 'guild', 'actor', 'ChannelDelete', 'channel-2', detectorConfig).cooldown, true, 'repeat incidents are throttled');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trivia-security-test-'));
  try {
    const storage = new JsonStorage(tempDir);
    await storage.set('guild-1', { enabled: true, whitelistUserIds: ['123'] });
    assert.deepEqual(await storage.get('guild-1'), { enabled: true, whitelistUserIds: ['123'] });
    await storage.delete('guild-1');
    assert.equal(await storage.get('guild-1'), null);

    const logger = { info() {}, warn() {}, error() {} };
    const manager = { storage, logger, notifications: { async incident() { return true; } }, async log() { return true; } };
    const incidents = new IncidentService(manager);
    const guild = { id: 'guild-1' };
    await incidents.record(guild, { type: 'TEST', description: 'Persistence test', severity: 'low', fields: [] });
    const restoredIncidents = new IncidentService(manager);
    const entries = await restoredIncidents.getRecent('guild-1', 5);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, 'TEST');
    assert.equal(entries[0].description, 'Persistence test');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log('All Trivia Protection tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
