export class SendNotificationCommand {
  constructor(
    public readonly deviceToken: string,
    public readonly title: string,
    public readonly body: string,
    public readonly data: Record<string, string> = {},
  ) {}
}
