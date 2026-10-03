import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { PushSender } from '../domain/push-sender.port';
import { TemporaryPushError } from '../domain/temporary-push.error';
import { DeviceToken } from '../domain/value-objects/device-token.vo';
import { NotificationContent } from '../domain/value-objects/notification-content.vo';

// FCM errors that can work if we try again later.
const TEMPORARY = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'app/network-error',
]);

@Injectable()
export class FcmPushSender implements PushSender {
  constructor() {
    if (!getApps().length) {
      const key = JSON.parse(
        readFileSync(
          process.env.FIREBASE_KEY_PATH ?? 'firebase-service-account.json',
          'utf8',
        ),
      );
      initializeApp({ credential: cert(key) });
    }
  }

  async send(token: DeviceToken, content: NotificationContent): Promise<void> {
    try {
      await getMessaging().send({
        token: token.value,
        notification: { title: content.title, body: content.body },
        data: content.data,
      });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (TEMPORARY.has(code)) {
        throw new TemporaryPushError(`${code}: ${(e as Error).message}`);
      }
      throw e;
    }
  }
}
