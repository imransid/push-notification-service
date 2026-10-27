import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeviceController } from '../../src/notification/presentation/device.controller';
import {
  RegisterDeviceDto,
  UnregisterSessionDto,
} from '../../src/notification/presentation/device.dto';
import { PostgresDeviceRepository } from '../../src/notification/infrastructure/postgres-device.repository';

const SESSION = '6f2a1c9e-8b3d-4e57-9a10-2c4d6e8f0a1b';
const device = {
  userId: 'user-123',
  app: 'customer',
  token: 'e3FpkP44l-h5uSHRN4uRWd:APA91b',
  platform: 'ios',
};

const failingFields = async (cls: any, body: object) => {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
};

describe('RegisterDeviceDto sessionId', () => {
  it('is optional', async () => {
    expect(await failingFields(RegisterDeviceDto, device)).toEqual([]);
  });

  it('accepts a uuid', async () => {
    const body = { ...device, sessionId: SESSION };
    expect(await failingFields(RegisterDeviceDto, body)).toEqual([]);
  });

  it('rejects anything else', async () => {
    const body = { ...device, sessionId: 'not-a-uuid' };
    expect(await failingFields(RegisterDeviceDto, body)).toEqual(['sessionId']);
  });
});

describe('UnregisterSessionDto', () => {
  it('needs a uuid', async () => {
    expect(await failingFields(UnregisterSessionDto, {})).toEqual([
      'sessionId',
    ]);
    expect(
      await failingFields(UnregisterSessionDto, { sessionId: SESSION }),
    ).toEqual([]);
  });
});

describe('DeviceController', () => {
  const repo = {
    upsert: vi.fn().mockResolvedValue(undefined),
    removeSession: vi.fn().mockResolvedValue(2),
  };
  const controller = new DeviceController(
    repo as unknown as PostgresDeviceRepository,
  );

  it('registers a device with its session', async () => {
    const dto = { ...device, sessionId: SESSION } as RegisterDeviceDto;
    expect(await controller.register(dto)).toEqual({ ok: true });
    expect(repo.upsert).toHaveBeenCalledWith(dto);
  });

  it("removes a session's devices", async () => {
    const dto = { sessionId: SESSION } as UnregisterSessionDto;
    expect(await controller.unregisterSession(dto)).toEqual({
      ok: true,
      removed: 2,
    });
    expect(repo.removeSession).toHaveBeenCalledWith(SESSION);
  });
});

describe('PostgresDeviceRepository', () => {
  const repo = new PostgresDeviceRepository();
  const query = vi.fn();
  (repo as any).pool = { query };

  beforeEach(() => query.mockReset());

  it('stores the session with the device, null without one', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await repo.upsert({ ...device, sessionId: SESSION });
    await repo.upsert(device);
    expect(query.mock.calls[0][0]).toContain(
      'session_id = EXCLUDED.session_id',
    );
    expect(query.mock.calls[0][1].at(-1)).toBe(SESSION);
    expect(query.mock.calls[1][1].at(-1)).toBeNull();
  });

  it('deletes by session and says how many', async () => {
    query.mockResolvedValue({ rowCount: 3 });
    expect(await repo.removeSession(SESSION)).toBe(3);
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM devices WHERE session_id = $1',
      [SESSION],
    );
  });
});
