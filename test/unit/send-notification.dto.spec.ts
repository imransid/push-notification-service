import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendNotificationDto } from '../../src/notification/presentation/send-notification.dto';

const check = (body: object) =>
  validate(plainToInstance(SendNotificationDto, body));

describe('SendNotificationDto', () => {
  it('accepts a valid body', async () => {
    const errors = await check({
      deviceToken: 'fake-token-1234567890',
      title: 'Hi',
      body: 'x',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a numeric title', async () => {
    const errors = await check({
      deviceToken: 'fake-token-1234567890',
      title: 123,
      body: 'x',
    });
    expect(errors[0].property).toBe('title');
  });

  it('rejects a missing body', async () => {
    const errors = await check({
      deviceToken: 'fake-token-1234567890',
      title: 'Hi',
    });
    expect(errors[0].property).toBe('body');
  });
});
