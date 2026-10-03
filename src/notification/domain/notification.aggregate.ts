import { randomUUID } from 'crypto';
import { AggregateRoot } from '@nestjs/cqrs';
import { DeviceToken } from './value-objects/device-token.vo';
import { NotificationContent } from './value-objects/notification-content.vo';
import { NotificationStatus } from './notification-status.enum';
import {
  NotificationCreatedEvent,
  NotificationFailedEvent,
  NotificationSentEvent,
} from './events/notification.events';

export class Notification extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _token: DeviceToken,
    private readonly _content: NotificationContent,
    private _status: NotificationStatus,
    private _failureReason: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(token: DeviceToken, content: NotificationContent) {
    const n = new Notification(
      randomUUID(),
      token,
      content,
      NotificationStatus.PENDING,
      null,
      new Date(),
    );
    n.apply(new NotificationCreatedEvent(n._id));
    return n;
  }

  static restore(p: {
    id: string;
    token: DeviceToken;
    content: NotificationContent;
    status: NotificationStatus;
    failureReason: string | null;
    createdAt: Date;
  }) {
    return new Notification(
      p.id,
      p.token,
      p.content,
      p.status,
      p.failureReason,
      p.createdAt,
    );
  }

  markSent() {
    if (this._status !== NotificationStatus.PENDING) {
      throw new Error('Already processed');
    }
    this._status = NotificationStatus.SENT;
    this.apply(new NotificationSentEvent(this._id));
  }

  markFailed(reason: string) {
    if (this._status !== NotificationStatus.PENDING) {
      throw new Error('Already processed');
    }
    this._status = NotificationStatus.FAILED;
    this._failureReason = reason;
    this.apply(new NotificationFailedEvent(this._id, reason));
  }

  get id() {
    return this._id;
  }
  get token() {
    return this._token;
  }
  get content() {
    return this._content;
  }
  get status() {
    return this._status;
  }
  get failureReason() {
    return this._failureReason;
  }
  get createdAt() {
    return this._createdAt;
  }
}
