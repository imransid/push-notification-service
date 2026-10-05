export class SendUserNotificationCommand {
  constructor(
    public readonly userId: string,
    public readonly eventId: string,
    public readonly title: string,
    public readonly body: string,
    public readonly data: Record<string, string> = {},
  ) {}
}
