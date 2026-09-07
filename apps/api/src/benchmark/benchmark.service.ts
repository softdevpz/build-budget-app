import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEY, CACHE_TTL_SECONDS, MIN_SAMPLE_SIZE } from './benchmark.constants';

type BucketKey = string; // `${region}|${stageCategory}`

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPublicStats(region?: string, stageCategory?: string) {
    const stats = await this.getCachedStats();
    return stats.filter(
      (stat) =>
        (!region || stat.region === region) &&
        (!stageCategory || stat.stageCategory === stageCategory),
    );
  }

  async triggerRecomputeNow() {
    const bucketsUpdated = await this.recompute();
    return { bucketsUpdated };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recompute(): Promise<number> {
    const stages = await this.prisma.stage.findMany({
      include: { project: true, expenses: true },
    });

    const buckets = new Map<BucketKey, number[]>();

    for (const stage of stages) {
      const { project } = stage;
      if (!project.region || !project.areaM2 || Number(project.areaM2) <= 0) {
        continue;
      }

      const stageSpent = stage.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      if (stageSpent <= 0) {
        continue;
      }

      const costPerM2 = stageSpent / Number(project.areaM2);
      const key: BucketKey = `${project.region}|${stage.name.trim().toLowerCase()}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(costPerM2);
      buckets.set(key, bucket);
    }

    for (const [key, values] of buckets) {
      const [region, stageCategory] = key.split('|');
      const avgCostPerM2 = values.reduce((sum, value) => sum + value, 0) / values.length;

      await this.prisma.benchmarkStat.upsert({
        where: { region_stageCategory: { region, stageCategory } },
        create: { region, stageCategory, avgCostPerM2, sampleSize: values.length },
        update: { avgCostPerM2, sampleSize: values.length },
      });
    }

    await this.redis.client.del(CACHE_KEY);
    this.logger.log(`Recomputed ${buckets.size} benchmark bucket(s)`);
    return buckets.size;
  }

  private async getCachedStats() {
    const cached = await this.redis.client.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Array<{
        region: string;
        stageCategory: string;
        avgCostPerM2: number;
        sampleSize: number;
      }>;
    }

    const stats = await this.prisma.benchmarkStat.findMany({
      where: { sampleSize: { gte: MIN_SAMPLE_SIZE } },
      orderBy: [{ region: 'asc' }, { stageCategory: 'asc' }],
    });
    const serializable = stats.map((stat) => ({
      region: stat.region,
      stageCategory: stat.stageCategory,
      avgCostPerM2: Number(stat.avgCostPerM2),
      sampleSize: stat.sampleSize,
    }));

    await this.redis.client.set(CACHE_KEY, JSON.stringify(serializable), 'EX', CACHE_TTL_SECONDS);
    return serializable;
  }
}
