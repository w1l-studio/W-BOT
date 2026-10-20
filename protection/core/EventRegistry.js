'use strict';

class EventRegistry {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
    this.handlers = [];
  }

  on(event, handler) {
    this.client.on(event, handler);
    this.handlers.push([event, handler]);
  }

  removeAll() {
    for (const [event, handler] of this.handlers) this.client.off(event, handler);
    this.handlers = [];
  }
}

module.exports = { EventRegistry };
