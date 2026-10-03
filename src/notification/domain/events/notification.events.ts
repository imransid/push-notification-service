import { IEvent } from '@nestjs/cqrs';

export class NotificationCreatedEvent implements IEvent {
  constructor(public readonly notificationId: string) {}
}

export class NotificationSentEvent implements IEvent {
  constructor(public readonly notificationId: string) {}
}

export class NotificationFailedEvent implements IEvent {
  constructor(
    public readonly notificationId: string,
    public readonly reason: string,
  ) {}
}
