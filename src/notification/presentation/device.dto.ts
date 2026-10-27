import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiProperty({ example: 'customer', description: 'Which mobile app' })
  @IsString()
  @MinLength(1)
  app: string;

  @ApiProperty({ example: 'e3FpkP44l-h5uSHRN4uRWd:APA91b...', minLength: 10 })
  @IsString()
  @MinLength(10)
  token: string;

  @ApiProperty({ enum: ['android', 'ios'] })
  @IsIn(['android', 'ios'])
  platform: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The app's sign-in session; POST /devices/unregister-session removes its devices",
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class UnregisterDeviceDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  token: string;
}

export class UnregisterSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId: string;
}
