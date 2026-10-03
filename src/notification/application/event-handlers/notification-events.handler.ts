import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  NotificationFailedEvent,
  NotificationSentEvent,
} from '../../domain/events/notification.events.js';

@EventsHandler(NotificationSentEvent)
export class NotificationSentHandler implements IEventHandler<NotificationSentEvent> {
  private readonly logger = new Logger(NotificationSentHandler.name);
  handle(e: NotificationSentEvent) {
    this.logger.log(`Sent: ${e.notificationId}`);
  }
}

@EventsHandler(NotificationFailedEvent)
export class NotificationFailedHandler implements IEventHandler<NotificationFailedEvent> {
  private readonly logger = new Logger(NotificationFailedHandler.name);
  handle(e: NotificationFailedEvent) {
    this.logger.warn(`Failed: ${e.notificationId} - ${e.reason}`);
  }
}
