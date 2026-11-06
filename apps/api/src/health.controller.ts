import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@courtly/contracts';

@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  @Get('health')
  health(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}
