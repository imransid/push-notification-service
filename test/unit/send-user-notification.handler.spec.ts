import { SendUserNotificationHandler } from '../../src/notification/application/commands/send-user-notification.handler';
import { SendUserNotificationCommand } from '../../src/notification/application/commands/send-user-notification.command';

const TOKEN = 'device-token-1234567890';

const setup = (opts: { inserted: boolean; pendingId: string | null }) => {
  const repo = {
    saveForUser: vi.fn(async () => opts.inserted),
    findPendingId: vi.fn(async () => opts.pendingId),
  };
  const devices = { findActiveTokens: vi.fn(async () => [TOKEN]) };
  const queue = {
    add: vi.fn(
      async (
        _name: string,
        _data: { id: string },
        _opts: { jobId: string },
      ) => ({}),
    ),
  };
  const publisher = { mergeObjectContext: (o: any) => o };
  const handler = new SendUserNotificationHandler(
    repo as any,
    devices as any,
    queue as any,
    publisher as any,
  );
  return { handler, queue };
};

const cmd = new SendUserNotificationCommand(
  'user-1',
  'booking:1:confirmed',
  'Booking confirmed',
  'See you soon',
  {},
);

describe('SendUserNotificationHandler', () => {
  it('queues a new notification with its own id as the jobId', async () => {
    const { handler, queue } = setup({ inserted: true, pendingId: null });
    const result = await handler.execute(cmd);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [, data, opts] = queue.add.mock.calls[0];
    expect(opts.jobId).toBe(data.id);
    expect(result.queued).toBe(1);
  });

  it('queues again when the old notification is still pending', async () => {
    const { handler, queue } = setup({ inserted: false, pendingId: 'old-id' });
    await handler.execute(cmd);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [, data, opts] = queue.add.mock.calls[0];
    expect(data.id).toBe('old-id');
    expect(opts.jobId).toBe('old-id');
  });

  it('does nothing when the old notification is no longer pending', async () => {
    const { handler, queue } = setup({ inserted: false, pendingId: null });
    await handler.execute(cmd);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
