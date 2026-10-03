import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({
    description: 'FCM registration token of the target device',
    example: 'e3FpkP44l-h5uSHRN4uRWd:APA91b...',
    minLength: 10,
  })
  @IsString()
  deviceToken: string;

  @ApiProperty({ example: 'Order shipped' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your order #1234 is on its way' })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    description: 'Custom key/value data. All values must be strings.',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { orderId: '1234' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
