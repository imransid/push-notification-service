import { Notification } from './notification.aggregate.js';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRepository {
  save(n: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
}
