import { DeviceToken } from './value-objects/device-token.vo.js';
import { NotificationContent } from './value-objects/notification-content.vo.js';

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushSender {
  send(token: DeviceToken, content: NotificationContent): Promise<void>;
}
