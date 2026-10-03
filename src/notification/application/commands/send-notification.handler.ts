import { Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import { SendNotificationCommand } from './send-notification.command';
import { Notification } from '../../domain/notification.aggregate';
import { DeviceToken } from '../../domain/value-objects/device-token.vo';
import { NotificationContent } from '../../domain/value-objects/notification-content.vo';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository';

@CommandHandler(SendNotificationCommand)
export class SendNotificationHandler implements ICommandHandler<
  SendNotificationCommand,
  string
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: SendNotificationCommand) {
    const notification = this.publisher.mergeObjectContext(
      Notification.create(
        DeviceToken.create(cmd.deviceToken),
        NotificationContent.create(cmd.title, cmd.body, cmd.data),
      ),
    );

    await this.repo.save(notification);
    notification.commit();
    await this.queue.add(
      'send',
      { id: notification.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
    return notification.id;
  }
}
