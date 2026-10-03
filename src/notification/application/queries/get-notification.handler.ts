import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetNotificationQuery } from './get-notification.query';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository';

@QueryHandler(GetNotificationQuery)
export class GetNotificationHandler implements IQueryHandler<GetNotificationQuery> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
  ) {}

  async execute(q: GetNotificationQuery) {
    const n = await this.repo.findById(q.id);
    if (!n) throw new NotFoundException('Notification not found');
    return {
      id: n.id,
      title: n.content.title,
      body: n.content.body,
      status: n.status,
      failureReason: n.failureReason,
      createdAt: n.createdAt,
    };
  }
}
