import { Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import { SendUserNotificationCommand } from './send-user-notification.command';
import { Notification } from '../../domain/notification.aggregate';
import { DeviceToken } from '../../domain/value-objects/device-token.vo';
import { NotificationContent } from '../../domain/value-objects/notification-content.vo';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository';
import { PostgresDeviceRepository } from '../../infrastructure/postgres-device.repository';

@CommandHandler(SendUserNotificationCommand)
export class SendUserNotificationHandler implements ICommandHandler<
  SendUserNotificationCommand,
  { devices: number; queued: number; duplicates: number }
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    private readonly devices: PostgresDeviceRepository,
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: SendUserNotificationCommand) {
    const tokens = await this.devices.findActiveTokens(cmd.userId);
    let queued = 0;

    for (const token of tokens) {
      const notification = this.publisher.mergeObjectContext(
        Notification.create(
          DeviceToken.create(token),
          NotificationContent.create(cmd.title, cmd.body, cmd.data),
        ),
      );

      const inserted = await this.repo.saveForUser(
        notification,
        cmd.userId,
        cmd.eventId,
      );
      if (!inserted) continue; // same event for this device already exists

      notification.commit();
      await this.queue.add(
        'send',
        { id: notification.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
      queued++;
    }

    return {
      devices: tokens.length,
      queued,
      duplicates: tokens.length - queued,
    };
  }
}
