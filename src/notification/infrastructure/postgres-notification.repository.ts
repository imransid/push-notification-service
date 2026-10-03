import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import type { NotificationRepository } from '../domain/notification.repository';
import { Notification } from '../domain/notification.aggregate';
import { NotificationStatus } from '../domain/notification-status.enum';
import { DeviceToken } from '../domain/value-objects/device-token.vo';
import { NotificationContent } from '../domain/value-objects/notification-content.vo';

@Injectable()
export class PostgresNotificationRepository
  implements NotificationRepository, OnModuleInit, OnModuleDestroy
{
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@127.0.0.1:5434/push',
  });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        device_token TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        failure_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async save(n: Notification): Promise<void> {
    await this.pool.query(
      `INSERT INTO notifications
         (id, device_token, title, body, data, status, failure_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET status = EXCLUDED.status,
             failure_reason = EXCLUDED.failure_reason`,
      [
        n.id,
        n.token.value,
        n.content.title,
        n.content.body,
        JSON.stringify(n.content.data),
        n.status,
        n.failureReason,
        n.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<Notification | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM notifications WHERE id = $1',
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return Notification.restore({
      id: r.id,
      token: DeviceToken.create(r.device_token),
      content: NotificationContent.create(r.title, r.body, r.data),
      status: r.status as NotificationStatus,
      failureReason: r.failure_reason,
      createdAt: r.created_at,
    });
  }
}
