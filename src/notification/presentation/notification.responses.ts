import { ApiProperty } from '@nestjs/swagger';
import { NotificationStatus } from '../domain/notification-status.enum';

export class SendNotificationResponseDto {
  @ApiProperty({ format: 'uuid', example: '73367643-d868-4bb4-abea-51583fd5d9f9' })
  id: string;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Order shipped' })
  title: string;

  @ApiProperty({ example: 'Your order #1234 is on its way' })
  body: string;

  @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.SENT })
  status: NotificationStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description: 'Why it failed. Null unless status is FAILED.',
  })
  failureReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Invalid device token',
    description: 'A string for domain/auth errors, a list for DTO validation errors.',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
