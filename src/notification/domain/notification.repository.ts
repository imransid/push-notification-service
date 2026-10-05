import { Notification } from './notification.aggregate.js';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRepository {
  save(n: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  saveForUser(
    n: Notification,
    userId: string,
    eventId: string,
  ): Promise<boolean>;
  findPendingId(
    userId: string,
    eventId: string,
    token: string,
  ): Promise<string | null>;
}
