import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { IsStringRecord } from './is-string-record.validator';

export class SendUserNotificationDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiProperty({
    example: 'booking:123:confirmed',
    description:
      'Unique per event. Sending the same eventId twice does nothing.',
  })
  @IsString()
  @MinLength(1)
  eventId: string;

  @ApiProperty({ example: 'Booking confirmed' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your booking #123 is confirmed' })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { type: 'booking', bookingId: '123' },
  })
  @IsOptional()
  @IsStringRecord()
  data?: Record<string, string>;
}
