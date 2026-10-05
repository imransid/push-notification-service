import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SendNotificationHandler } from './application/commands/send-notification.handler.js';
import { GetNotificationHandler } from './application/queries/get-notification.handler.js';
import {
  NotificationSentHandler,
  NotificationFailedHandler,
} from './application/event-handlers/notification-events.handler.js';
import { NOTIFICATION_REPOSITORY } from './domain/notification.repository.js';
import { PUSH_SENDER } from './domain/push-sender.port.js';
import { PostgresNotificationRepository } from './infrastructure/postgres-notification.repository.js';
import { FcmPushSender } from './infrastructure/fcm-push-sender.js';
import { NotificationController } from './presentation/notification.controller.js';

import { BullModule } from '@nestjs/bullmq';
import { SendNotificationProcessor } from './application/send-notification.processor';
import { DeviceController } from './presentation/device.controller.js';
import { PostgresDeviceRepository } from './infrastructure/postgres-device.repository.js';

@Module({
  imports: [
    CqrsModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6381),
      },
    }),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationController, DeviceController],
  providers: [
    SendNotificationHandler,
    SendNotificationProcessor,
    GetNotificationHandler,
    NotificationSentHandler,
    PostgresDeviceRepository,
    NotificationFailedHandler,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PostgresNotificationRepository,
    },
    { provide: PUSH_SENDER, useClass: FcmPushSender },
  ],
})
export class NotificationModule {}
