import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendUserNotificationDto } from '../../src/notification/presentation/send-user-notification.dto';

const valid = {
  userId: 'user-123',
  eventId: 'booking:123:confirmed',
  title: 'Booking confirmed',
  body: 'Your booking #123 is confirmed',
};

const failingFields = async (body: object) => {
  const dto = plainToInstance(SendUserNotificationDto, body);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
};

describe('SendUserNotificationDto data', () => {
  it('accepts a body without data', async () => {
    expect(await failingFields(valid)).toEqual([]);
  });

  it('accepts data where every value is a string', async () => {
    const body = { ...valid, data: { type: 'booking', bookingId: '123' } };
    expect(await failingFields(body)).toEqual([]);
  });

  it('rejects data with a number value', async () => {
    const body = { ...valid, data: { bookingId: 123 } };
    expect(await failingFields(body)).toEqual(['data']);
  });

  it('rejects data that is an array', async () => {
    const body = { ...valid, data: ['booking', '123'] };
    expect(await failingFields(body)).toEqual(['data']);
  });
});
