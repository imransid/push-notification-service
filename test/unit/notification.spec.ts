import { describe, it, expect } from 'vitest';
import { Notification } from '../../src/notification/domain/notification.aggregate';
import { DeviceToken } from '../../src/notification/domain/value-objects/device-token.vo';
import { NotificationContent } from '../../src/notification/domain/value-objects/notification-content.vo';
import { NotificationStatus } from '../../src/notification/domain/notification-status.enum';
import { DomainError } from '../../src/notification/domain/domain.error';

const make = () =>
  Notification.create(
    DeviceToken.create('fake-token-1234567890'),
    NotificationContent.create('Hi', 'Body'),
  );

describe('DeviceToken', () => {
  it('rejects short tokens with a DomainError', () => {
    expect(() => DeviceToken.create('abc')).toThrow(DomainError);
  });
});

describe('NotificationContent', () => {
  it('requires title and body', () => {
    expect(() => NotificationContent.create('', 'x')).toThrow('Title is required');
    expect(() => NotificationContent.create('x', ' ')).toThrow('Body is required');
  });
});

describe('Notification', () => {
  it('starts as PENDING', () => {
    expect(make().status).toBe(NotificationStatus.PENDING);
  });

  it('markSent sets SENT', () => {
    const n = make();
    n.markSent();
    expect(n.status).toBe(NotificationStatus.SENT);
  });

  it('markFailed stores the reason', () => {
    const n = make();
    n.markFailed('bad token');
    expect(n.status).toBe(NotificationStatus.FAILED);
    expect(n.failureReason).toBe('bad token');
  });

  it('cannot be processed twice', () => {
    const n = make();
    n.markSent();
    expect(() => n.markFailed('x')).toThrow('Already processed');
  });
});
