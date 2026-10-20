'use strict';

class NotificationService {
  constructor(manager) { this.manager = manager; }

  async incident(guild, incident) {
    const color = incident.severity === 'high' || incident.severity === 'critical'
      ? 0xED4245
      : incident.severity === 'low' ? 0xFEE75C : 0x5865F2;
    const fields = [
      ...(Array.isArray(incident.fields) ? incident.fields : []),
      { name: 'الخطورة', value: String(incident.severity || 'medium'), inline: true },
      { name: 'معرّف الحادثة', value: String(incident.id || '—'), inline: true },
    ];
    return this.manager.log(guild, `🛡️ ${incident.type || 'UNKNOWN'}`, incident.description || 'Protection event', fields, color);
  }
}

module.exports = { NotificationService };
