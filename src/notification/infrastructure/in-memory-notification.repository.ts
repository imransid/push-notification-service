import { Injectable } from '@nestjs/common';
import type { NotificationRepository } from '../domain/notification.repository.js';
import { Notification } from '../domain/notification.aggregate.js';

@Injectable()
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly store = new Map<string, Notification>();

  async save(n: Notification): Promise<void> {
    this.store.set(n.id, n);
  }

  async findById(id: string): Promise<Notification | null> {
    return this.store.get(id) ?? null;
  }

  async saveForUser(n: Notification, _userId: string, _eventId: string) {
    await this.save(n);
    return true;
  }

  async findPendingId(_userId: string, _eventId: string, _token: string) {
    // This notebook never blocks duplicates (saveForUser always returns true),
    // so there is never an old waiting order to send again.
    return null;
  }
}
