import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

export interface RegisterDeviceInput {
  userId: string;
  app: string;
  token: string;
  platform: string;
}

@Injectable()
export class PostgresDeviceRepository implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@127.0.0.1:5434/push',
  });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        app TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS devices_user_status_idx
         ON devices (user_id, status)`,
    );
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // Same token again = update the row, never a duplicate.
  // If the token now belongs to a different user (logout, then another
  // login on the same phone), it moves to the new user.
  async upsert(d: RegisterDeviceInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO devices (id, user_id, app, token, platform)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             app = EXCLUDED.app,
             platform = EXCLUDED.platform,
             status = 'active',
             last_seen_at = now()`,
      [randomUUID(), d.userId, d.app, d.token, d.platform],
    );
  }

  async remove(token: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM devices WHERE token = $1',
      [token],
    );
    return (rowCount ?? 0) > 0;
  }
}
