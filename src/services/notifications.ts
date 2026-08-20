import { NotificationItem } from '../types';
import { createId } from '../lib/id';
import { dbService } from './db';

const KEY = 'postura_notifications_v4';

class NotificationService {
  private items: NotificationItem[] = [];

  constructor() {
    try {
      this.items = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      this.items = [];
    }
  }

  private persist() {
    localStorage.setItem(KEY, JSON.stringify(this.items.slice(0, 200)));
  }

  public push(input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): NotificationItem {
    const item: NotificationItem = {
      ...input,
      id: createId('ntf'),
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.items.unshift(item);
    this.persist();
    return item;
  }

  public forUser(uid: string, clientId?: string | null): NotificationItem[] {
    return this.items.filter((n) => n.userId === uid || (clientId && n.clientId === clientId));
  }

  public unreadCount(uid: string, clientId?: string | null): number {
    return this.forUser(uid, clientId).filter((n) => !n.read).length;
  }

  public markRead(id: string) {
    const item = this.items.find((n) => n.id === id);
    if (item) {
      item.read = true;
      this.persist();
    }
  }

  public markAllRead(uid: string) {
    this.items.forEach((n) => {
      if (n.userId === uid) n.read = true;
    });
    this.persist();
  }
}

/** Notifica solo si el cliente tiene cuenta vinculada; evita envíos a Juan por defecto. */
export function notifyClient(
  clientId: string,
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'userId' | 'clientId'>
): boolean {
  const client = dbService.getClientById(clientId);
  if (!client?.userId) return false;
  notificationService.push({ ...input, userId: client.userId, clientId });
  return true;
}

export const notificationService = new NotificationService();
