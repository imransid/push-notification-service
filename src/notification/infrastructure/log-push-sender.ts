import { Injectable, Logger } from '@nestjs/common';
import type { PushSender } from '../domain/push-sender.port.js';
import { DeviceToken } from '../domain/value-objects/device-token.vo.js';
import { NotificationContent } from '../domain/value-objects/notification-content.vo.js';

@Injectable()
export class LogPushSender implements PushSender {
  private readonly logger = new Logger(LogPushSender.name);

  async send(token: DeviceToken, content: NotificationContent): Promise<void> {
    this.logger.log(
      `Fake push to ${JSON.stringify(token)}: ${JSON.stringify(content)}`,
    );
  }
}
