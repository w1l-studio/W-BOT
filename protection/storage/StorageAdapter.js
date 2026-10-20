'use strict';

class StorageAdapter {
  async get(_guildId) { throw new Error('StorageAdapter.get must be implemented'); }
  async set(_guildId, _value) { throw new Error('StorageAdapter.set must be implemented'); }
  async delete(_guildId) { throw new Error('StorageAdapter.delete must be implemented'); }
}

module.exports = { StorageAdapter };
