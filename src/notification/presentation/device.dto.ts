import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

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
}

export class UnregisterDeviceDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  token: string;
}
