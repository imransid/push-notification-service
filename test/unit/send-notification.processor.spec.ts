import { describe, it, expect, vi } from 'vitest';
import { SendNotificationProcessor } from '../../src/notification/application/send-notification.processor';
import { Notification } from '../../src/notification/domain/notification.aggregate';
import { DeviceToken } from '../../src/notification/domain/value-objects/device-token.vo';
import { NotificationContent } from '../../src/notification/domain/value-objects/notification-content.vo';
import { NotificationStatus } from '../../src/notification/domain/notification-status.enum';

const setup = (sendImpl: () => Promise<void>) => {
  const n = Notification.create(
    DeviceToken.create('fake-token-1234567890'),
    NotificationContent.create('Hi', 'Body'),
  );
  const saved: any[] = [];
  const repo = {
    findById: async () => n,
    save: async (x: any) => void saved.push(x),
  };
  const sender = { send: vi.fn(sendImpl) };
  const publisher = { mergeObjectContext: (o: any) => o } as any;
  const devices = { markInvalid: vi.fn() };
  const processor = new SendNotificationProcessor(
    repo as any,
    sender as any,
    publisher,
    devices as any,
  );
  return { processor, n, sender };
};

describe('SendNotificationProcessor', () => {
  it('marks SENT when the push works', async () => {
    const { processor, n } = setup(async () => {});
    await processor.process({ data: { id: n.id } } as any);
    expect(n.status).toBe(NotificationStatus.SENT);
  });

  it('marks FAILED when the push fails', async () => {
    const { processor, n } = setup(async () => {
      throw new Error('FCM rejected');
    });
    await processor.process({ data: { id: n.id } } as any);
    expect(n.status).toBe(NotificationStatus.FAILED);
    expect(n.failureReason).toBe('FCM rejected');
  });

  it('does not send twice', async () => {
    const { processor, n, sender } = setup(async () => {});
    await processor.process({ data: { id: n.id } } as any);
    await processor.process({ data: { id: n.id } } as any);
    expect(sender.send).toHaveBeenCalledTimes(1);
  });
});

import { TemporaryPushError } from '../../src/notification/domain/temporary-push.error';

describe('SendNotificationProcessor retries', () => {
  const temporary = async () => {
    throw new TemporaryPushError('FCM busy');
  };

  it('rethrows a temporary error and stays PENDING when tries are left', async () => {
    const { processor, n } = setup(temporary);
    await expect(
      processor.process({
        data: { id: n.id },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any),
    ).rejects.toThrow('FCM busy');
    expect(n.status).toBe(NotificationStatus.PENDING);
  });

  it('marks FAILED on the last attempt', async () => {
    const { processor, n } = setup(temporary);
    await processor.process({
      data: { id: n.id },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as any);
    expect(n.status).toBe(NotificationStatus.FAILED);
  });

  it('does not retry a permanent error', async () => {
    const { processor, n } = setup(async () => {
      throw new Error('invalid token');
    });
    await processor.process({
      data: { id: n.id },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any);
    expect(n.status).toBe(NotificationStatus.FAILED);
  });
});
