import { AuditEvent, User } from '../types';

class AuditService {
  private events: AuditEvent[] = [];

  constructor() {
    const saved = localStorage.getItem('postura_audit_logs');
    if (saved) {
      try {
        this.events = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse audit logs', e);
      }
    }
  }

  public log(
    user: User | null,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>
  ): void {
    // Sanitize details to ensure NO API keys or sensitive raw credentials ever get logged
    const sanitizedDetails = details ? { ...details } : {};
    for (const key in sanitizedDetails) {
      if (/key|secret|token|password|cred/i.test(key)) {
        sanitizedDetails[key] = '***REDACTED***';
      }
    }

    const event: AuditEvent = {
      id: 'aud_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      actorUid: user ? user.uid : 'system',
      actorEmail: user ? user.email : 'system@postura.internal',
      actorRole: user ? user.role : 'ADMIN',
      action,
      entityType,
      entityId,
      details: sanitizedDetails,
    };

    this.events.unshift(event);
    if (this.events.length > 500) {
      this.events = this.events.slice(0, 500);
    }
    localStorage.setItem('postura_audit_logs', JSON.stringify(this.events));
  }

  public getRecentLogs(limit = 25): AuditEvent[] {
    return this.events.slice(0, limit);
  }
}

export const auditService = new AuditService();
