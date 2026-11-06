import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, HealthStatus } from './app.service.js';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Estado del servicio',
    description:
      'Endpoint de salud: confirma que el proceso esta vivo y que la base de ' +
      'datos responde.',
  })
  @ApiOkResponse({
    description: 'Estado del servicio',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'up' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }
}
