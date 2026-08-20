import { dbService } from './db';
import { notifyClient } from './notifications';
const REMINDER_SENT_KEY = 'postura_reminders_sent_v1';
const EMAIL_STUB_KEY = 'postura_email_stub_v1';

interface ReminderSentRecord {
  key: string;
  sentAt: string;
}

export interface EmailStubEntry {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}

function loadSentKeys(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDER_SENT_KEY) || '[]') as ReminderSentRecord[];
    return new Set(raw.map((entry) => entry.key));
  } catch {
    return new Set();
  }
}

function persistSentKey(key: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDER_SENT_KEY) || '[]') as ReminderSentRecord[];
    raw.unshift({ key, sentAt: new Date().toISOString() });
    localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(raw.slice(0, 200)));
  } catch {
    localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify([{ key, sentAt: new Date().toISOString() }]));
  }
}

function pushEmailStub(to: string, subject: string, body: string) {
  try {
    const items = JSON.parse(localStorage.getItem(EMAIL_STUB_KEY) || '[]') as EmailStubEntry[];
    items.unshift({
      id: `mail_${Date.now()}`,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(EMAIL_STUB_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* noop */
  }
}

const REMINDER_WINDOW_MS = 3 * 86400000;

/** Escanea deadlines próximos y emite avisos in-app + stub de email (Oleada 6.4). */
export function processDeadlineReminders(): number {
  const sent = loadSentKeys();
  const now = Date.now();
  let created = 0;

  for (const client of dbService.getClients()) {
    if (!client.userId) continue;

    const tasks = dbService.getTasksByClient(client.id).filter(
      (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && task.deadline
    );
    for (const task of tasks) {
      const deadlineMs = new Date(task.deadline!).getTime();
      const delta = deadlineMs - now;
      if (delta < 0 || delta > REMINDER_WINDOW_MS) continue;

      const key = `task:${task.id}:${task.deadline!.slice(0, 10)}`;
      if (sent.has(key)) continue;

      const daysLeft = Math.max(1, Math.ceil(delta / 86400000));
      const body = `«${task.title}» vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}.`;
      notifyClient(client.id, {
        type: 'TASK_ASSIGNED',
        title: 'Recordatorio de deadline',
        body,
        href: 'client-feed',
      });
      pushEmailStub(client.primaryEmail, `[POSTURA stub] Recordatorio: ${task.title}`, body);

      persistSentKey(key);
      created += 1;
    }

    const opportunities = dbService.getOpportunitiesByClient(client.id).filter((opp) => {
      const stage = opp.lifecycleStage;
      return stage !== 'submitted' && stage !== 'declined' && opp.deadline;
    });
    for (const opp of opportunities) {
      const deadlineMs = new Date(opp.deadline).getTime();
      const delta = deadlineMs - now;
      if (delta < 0 || delta > REMINDER_WINDOW_MS) continue;

      const key = `opp:${opp.id}:${opp.deadline.slice(0, 10)}`;
      if (sent.has(key)) continue;

      const daysLeft = Math.max(1, Math.ceil(delta / 86400000));
      const body = `La oportunidad «${opp.title}» cierra en ${daysLeft} día${daysLeft === 1 ? '' : 's'}.`;
      notifyClient(client.id, {
        type: 'OPPORTUNITY',
        title: 'Recordatorio de oportunidad',
        body,
        href: 'client-opps',
      });
      pushEmailStub(client.primaryEmail, `[POSTURA stub] Oportunidad: ${opp.title}`, body);

      persistSentKey(key);
      created += 1;
    }
  }

  return created;
}

export function getEmailStubLog(): EmailStubEntry[] {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_STUB_KEY) || '[]') as EmailStubEntry[];
  } catch {
    return [];
  }
}
