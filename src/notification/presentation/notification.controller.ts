import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SendNotificationCommand } from '../application/commands/send-notification.command';
import { GetNotificationQuery } from '../application/queries/get-notification.query';
import { DomainError } from '../domain/domain.error';
import { ApiKeyGuard } from './api-key.guard';
import { SendNotificationDto } from './send-notification.dto';
import {
  ErrorResponseDto,
  NotificationResponseDto,
  SendNotificationResponseDto,
} from './notification.responses';

@ApiTags('notifications')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid API key',
  type: ErrorResponseDto,
})
@UseGuards(ApiKeyGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Send a push notification',
    description:
      'Creates a notification, sends it through FCM, and returns its id.',
  })
  @HttpCode(202)
  @ApiAcceptedResponse({
    description:
      'Accepted for delivery. Poll GET /notifications/{id} for the final status.',
    type: SendNotificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Wrong data shape (DTO) or a broken business rule (domain)',
    type: ErrorResponseDto,
  })
  async send(
    @Body() dto: SendNotificationDto,
  ): Promise<SendNotificationResponseDto> {
    try {
      const id = await this.commandBus.execute(
        new SendNotificationCommand(
          dto.deviceToken,
          dto.title,
          dto.body,
          dto.data ?? {},
        ),
      );
      return { id };
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification and its delivery status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({
    description: 'Notification not found',
    type: ErrorResponseDto,
  })
  get(@Param('id') id: string): Promise<NotificationResponseDto> {
    return this.queryBus.execute(new GetNotificationQuery(id));
  }
}
