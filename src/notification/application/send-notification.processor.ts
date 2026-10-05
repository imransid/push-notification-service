import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventPublisher } from '@nestjs/cqrs';
import type { Job } from 'bullmq';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../domain/notification.repository';
import { PUSH_SENDER, type PushSender } from '../domain/push-sender.port';
import { NotificationStatus } from '../domain/notification-status.enum';
import { TemporaryPushError } from '../domain/temporary-push.error';
import { PostgresDeviceRepository } from '../infrastructure/postgres-device.repository';

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

@Processor('notifications')
export class SendNotificationProcessor extends WorkerHost {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
    private readonly publisher: EventPublisher,
    private readonly devices: PostgresDeviceRepository,
  ) {
    super();
  }

  async process(job: Job<{ id: string }>) {
    const found = await this.repo.findById(job.data.id);
    if (!found) return;

    const notification = this.publisher.mergeObjectContext(found);
    if (notification.status !== NotificationStatus.PENDING) return;

    try {
      await this.sender.send(notification.token, notification.content);
      notification.markSent();
    } catch (e) {
      const maxAttempts = job.opts?.attempts ?? 1;
      const isLastAttempt = (job.attemptsMade ?? 0) + 1 >= maxAttempts;

      // Temporary error with tries left: throw, BullMQ retries later.
      // The notification stays PENDING.
      if (e instanceof TemporaryPushError && !isLastAttempt) throw e;

      const code = (e as { code?: string }).code ?? '';
      if (DEAD_TOKEN_CODES.has(code)) {
        await this.devices.markInvalid(notification.token.value);
      }

      notification.markFailed(e instanceof Error ? e.message : 'Unknown error');
    }

    await this.repo.save(notification);
    notification.commit();
  }
}
