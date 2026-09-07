import { BenchmarkService } from './benchmark.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEY, MIN_SAMPLE_SIZE } from './benchmark.constants';

function makeStage(overrides: Partial<any> = {}) {
  return {
    id: 'stage-1',
    name: 'Fundamenty',
    project: { region: 'mazowieckie', areaM2: 100 },
    expenses: [{ amount: 30000 }],
    ...overrides,
  };
}

describe('BenchmarkService', () => {
  let prisma: { stage: { findMany: jest.Mock }; benchmarkStat: Record<string, jest.Mock> };
  let redis: { client: { get: jest.Mock; set: jest.Mock; del: jest.Mock } };
  let service: BenchmarkService;

  beforeEach(() => {
    prisma = {
      stage: { findMany: jest.fn() },
      benchmarkStat: { upsert: jest.fn(), findMany: jest.fn() },
    };
    redis = { client: { get: jest.fn(), set: jest.fn(), del: jest.fn() } };
    service = new BenchmarkService(prisma as unknown as PrismaService, redis as unknown as RedisService);
  });

  describe('recompute', () => {
    it('skips projects with no region or no area (can\'t compute cost/m²)', async () => {
      prisma.stage.findMany.mockResolvedValue([
        makeStage({ project: { region: null, areaM2: 100 } }),
        makeStage({ project: { region: 'mazowieckie', areaM2: null } }),
      ]);

      const buckets = await service.recompute();

      expect(buckets).toBe(0);
      expect(prisma.benchmarkStat.upsert).not.toHaveBeenCalled();
    });

    it('skips stages with zero recorded spend', async () => {
      prisma.stage.findMany.mockResolvedValue([makeStage({ expenses: [] })]);

      const buckets = await service.recompute();

      expect(buckets).toBe(0);
    });

    it('averages cost/m² across stages sharing a region + stage name, case-insensitively', async () => {
      prisma.stage.findMany.mockResolvedValue([
        makeStage({ name: 'Fundamenty', project: { region: 'mazowieckie', areaM2: 100 }, expenses: [{ amount: 30000 }] }), // 300/m2
        makeStage({ name: 'fundamenty', project: { region: 'mazowieckie', areaM2: 120 }, expenses: [{ amount: 33600 }] }), // 280/m2
      ]);

      await service.recompute();

      expect(prisma.benchmarkStat.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.benchmarkStat.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ region_stageCategory: { region: 'mazowieckie', stageCategory: 'fundamenty' } });
      expect(call.create.sampleSize).toBe(2);
      expect(call.create.avgCostPerM2).toBeCloseTo(290, 5);
    });

    it('invalidates the Redis cache after recomputing', async () => {
      prisma.stage.findMany.mockResolvedValue([]);

      await service.recompute();

      expect(redis.client.del).toHaveBeenCalledWith(CACHE_KEY);
    });
  });

  describe('getPublicStats', () => {
    it('only ever surfaces buckets meeting MIN_SAMPLE_SIZE (privacy threshold)', async () => {
      redis.client.get.mockResolvedValue(null);
      prisma.benchmarkStat.findMany.mockResolvedValue([
        { region: 'mazowieckie', stageCategory: 'fundamenty', avgCostPerM2: { toString: () => '290' }, sampleSize: 5 },
      ]);
      // Simulate Prisma's own `where: sampleSize >= MIN_SAMPLE_SIZE` filter behavior
      // by asserting the query really does filter server-side, not just trust the mock.
      await service.getPublicStats();

      expect(prisma.benchmarkStat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sampleSize: { gte: MIN_SAMPLE_SIZE } } }),
      );
    });

    it('filters by region and stageCategory when provided', async () => {
      redis.client.get.mockResolvedValue(
        JSON.stringify([
          { region: 'mazowieckie', stageCategory: 'fundamenty', avgCostPerM2: 290, sampleSize: 5 },
          { region: 'malopolskie', stageCategory: 'dach', avgCostPerM2: 400, sampleSize: 10 },
        ]),
      );

      const result = await service.getPublicStats('mazowieckie');

      expect(result).toEqual([
        { region: 'mazowieckie', stageCategory: 'fundamenty', avgCostPerM2: 290, sampleSize: 5 },
      ]);
    });
  });
});
