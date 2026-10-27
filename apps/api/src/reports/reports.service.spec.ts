import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

function makePrismaMock() {
  return {
    report: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeProjectsServiceMock() {
  return { findOwned: jest.fn().mockResolvedValue({ id: 'project-1' }) };
}

function makeS3ServiceMock() {
  return { getDownloadUrl: jest.fn(), deleteObject: jest.fn() };
}

function makeQueueMock() {
  return { add: jest.fn() };
}

describe('ReportsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let projectsService: ReturnType<typeof makeProjectsServiceMock>;
  let s3Service: ReturnType<typeof makeS3ServiceMock>;
  let queue: ReturnType<typeof makeQueueMock>;
  let service: ReportsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    projectsService = makeProjectsServiceMock();
    s3Service = makeS3ServiceMock();
    queue = makeQueueMock();
    service = new ReportsService(prisma as any, projectsService as any, s3Service as any, queue as any);
  });

  describe('requestReport', () => {
    it('creates a pending report and enqueues a generation job', async () => {
      prisma.report.create.mockResolvedValue({ id: 'report-1', status: 'pending' });

      const report = await service.requestReport('user-1', 'project-1');

      expect(projectsService.findOwned).toHaveBeenCalledWith('user-1', 'project-1');
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: { projectId: 'project-1', status: 'pending' },
      });
      expect(queue.add).toHaveBeenCalledWith('generate', { reportId: 'report-1', projectId: 'project-1' });
      expect(report).toEqual({ id: 'report-1', status: 'pending' });
    });
  });

  describe('findAll', () => {
    it('lists reports for the project, newest first', async () => {
      await service.findAll('user-1', 'project-1');

      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { requestedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws 404 when the report does not exist', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'project-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the report belongs to a different project', async () => {
      prisma.report.findUnique.mockResolvedValue({ id: 'report-1', projectId: 'other-project' });

      await expect(service.findOne('user-1', 'project-1', 'report-1')).rejects.toThrow(NotFoundException);
    });

    it('attaches a download url for a completed report', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        projectId: 'project-1',
        status: 'completed',
        fileUrl: 'reports/project-1/report-1.pdf',
      });
      s3Service.getDownloadUrl.mockResolvedValue('https://signed-url');

      const result = await service.findOne('user-1', 'project-1', 'report-1');

      expect(s3Service.getDownloadUrl).toHaveBeenCalledWith('reports/project-1/report-1.pdf');
      expect(result).toMatchObject({ downloadUrl: 'https://signed-url' });
    });

    it('returns a pending report without a download url', async () => {
      prisma.report.findUnique.mockResolvedValue({ id: 'report-1', projectId: 'project-1', status: 'pending' });

      const result = await service.findOne('user-1', 'project-1', 'report-1');

      expect(s3Service.getDownloadUrl).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('downloadUrl');
    });
  });

  describe('remove', () => {
    it('throws 404 when the report does not belong to this project', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', 'project-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(prisma.report.delete).not.toHaveBeenCalled();
    });

    it('deletes the S3 object and the row for a completed report', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        projectId: 'project-1',
        status: 'completed',
        fileUrl: 'reports/project-1/report-1.pdf',
      });

      await service.remove('user-1', 'project-1', 'report-1');

      expect(s3Service.deleteObject).toHaveBeenCalledWith('reports/project-1/report-1.pdf');
      expect(prisma.report.delete).toHaveBeenCalledWith({ where: { id: 'report-1' } });
    });

    it('skips the S3 call for a report with no generated file yet', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        projectId: 'project-1',
        status: 'pending',
        fileUrl: null,
      });

      await service.remove('user-1', 'project-1', 'report-1');

      expect(s3Service.deleteObject).not.toHaveBeenCalled();
      expect(prisma.report.delete).toHaveBeenCalledWith({ where: { id: 'report-1' } });
    });
  });
});
