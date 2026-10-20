'use strict';

class Logger {
  constructor(scope = 'Protection') { this.scope = scope; }
  info(message, ...args) { console.log(`[${this.scope}] ${message}`, ...args); }
  warn(message, ...args) { console.warn(`[${this.scope}] ${message}`, ...args); }
  error(message, ...args) { console.error(`[${this.scope}] ${message}`, ...args); }
}

module.exports = { Logger };
