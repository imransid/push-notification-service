import { describe, it, expect, vi } from 'vitest';
import { SendNotificationHandler } from '../../src/notification/application/commands/send-notification.handler';
import { SendNotificationCommand } from '../../src/notification/application/commands/send-notification.command';
import { NotificationStatus } from '../../src/notification/domain/notification-status.enum';

describe('SendNotificationHandler', () => {
  it('saves a PENDING notification and enqueues a job', async () => {
    const saved: any[] = [];
    const repo = { save: async (n: any) => void saved.push(n), findById: vi.fn() };
    const queue = { add: vi.fn(async () => undefined) };
    const publisher = { mergeObjectContext: (o: any) => o } as any;
    const handler = new SendNotificationHandler(repo as any, queue as any, publisher);

    const id = await handler.execute(
      new SendNotificationCommand('fake-token-1234567890', 'Hi', 'Body'),
    );

    expect(saved[0].status).toBe(NotificationStatus.PENDING);
    expect(queue.add).toHaveBeenCalledWith('send', { id }, expect.objectContaining({ attempts: 3 }));
  });
});
