import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

export interface RegisterDeviceInput {
  userId: string;
  app: string;
  token: string;
  platform: string;
  // The app's sign-in session (customer-api's sid), so the session's
  // devices can be removed with it. Absent: null.
  sessionId?: string;
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
    // Added later, so ALTER and not in the CREATE above: tables made
    // before it get the column too. Nullable: a device registered
    // without a session has none.
    await this.pool.query(
      `ALTER TABLE devices ADD COLUMN IF NOT EXISTS session_id UUID`,
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS devices_session_idx
         ON devices (session_id) WHERE session_id IS NOT NULL`,
    );
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // Same token again = update the row, never a duplicate.
  // If the token now belongs to a different user (logout, then another
  // login on the same phone), it moves to the new user. It takes the
  // session of the registration that sent it last, or none.
  async upsert(d: RegisterDeviceInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO devices (id, user_id, app, token, platform, session_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             app = EXCLUDED.app,
             platform = EXCLUDED.platform,
             session_id = EXCLUDED.session_id,
             status = 'active',
             last_seen_at = now()`,
      [randomUUID(), d.userId, d.app, d.token, d.platform, d.sessionId ?? null],
    );
  }

  async findActiveTokens(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT token FROM devices WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    return rows.map((r) => r.token as string);
  }

  async markInvalid(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE devices SET status = 'invalid' WHERE token = $1`,
      [token],
    );
  }

  async remove(token: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM devices WHERE token = $1',
      [token],
    );
    return (rowCount ?? 0) > 0;
  }

  // Every device registered under this session: the app signed it out.
  async removeSession(sessionId: string): Promise<number> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM devices WHERE session_id = $1',
      [sessionId],
    );
    return rowCount ?? 0;
  }
}
