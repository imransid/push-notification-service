import {
  Body,
  Controller,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from './api-key.guard';
import { PostgresDeviceRepository } from '../infrastructure/postgres-device.repository';
import { RegisterDeviceDto, UnregisterDeviceDto } from './device.dto';

@ApiTags('devices')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('devices')
export class DeviceController {
  constructor(private readonly devices: PostgresDeviceRepository) {}

  @Put()
  async register(@Body() dto: RegisterDeviceDto) {
    await this.devices.upsert(dto);
    return { ok: true };
  }

  @Post('unregister')
  @HttpCode(200)
  async unregister(@Body() dto: UnregisterDeviceDto) {
    const removed = await this.devices.remove(dto.token);
    return { ok: true, removed };
  }
}
