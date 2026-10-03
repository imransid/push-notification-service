import { DomainError } from '../domain.error';

export class NotificationContent {
  private constructor(
    public readonly title: string,
    public readonly body: string,
    public readonly data: Record<string, string>,
  ) {}

  static create(
    title: string,
    body: string,
    data: Record<string, string> = {},
  ) {
    if (!title?.trim()) throw new DomainError('Title is required');
    if (!body?.trim()) throw new DomainError('Body is required');
    return new NotificationContent(title.trim(), body.trim(), data);
  }
}
