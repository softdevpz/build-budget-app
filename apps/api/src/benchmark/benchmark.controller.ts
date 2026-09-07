import { Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BenchmarkService } from './benchmark.service';

@Controller('benchmark')
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  // Public and anonymous on purpose — see MIN_SAMPLE_SIZE in benchmark.constants.ts.
  @Get()
  getStats(@Query('region') region?: string, @Query('stageCategory') stageCategory?: string) {
    return this.benchmarkService.getPublicStats(region, stageCategory);
  }

  // Lets us trigger the nightly recompute on demand instead of waiting for the cron.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('recompute-now')
  recomputeNow() {
    return this.benchmarkService.triggerRecomputeNow();
  }
}
