import { DomainError } from '../domain.error';

export class DeviceToken {
  private constructor(public readonly value: string) {}

  static create(value: string) {
    if (!value || value.trim().length < 10) {
      throw new DomainError('Invalid device token');
    }
    return new DeviceToken(value.trim());
  }
}
