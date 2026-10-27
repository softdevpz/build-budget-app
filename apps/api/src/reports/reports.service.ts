import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { S3Service } from '../storage/s3.service';
import { REPORTS_QUEUE, ReportJobData } from './reports.constants';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly s3Service: S3Service,
    @InjectQueue(REPORTS_QUEUE) private readonly reportsQueue: Queue<ReportJobData>,
  ) {}

  async requestReport(userId: string, projectId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const report = await this.prisma.report.create({
      data: { projectId, status: 'pending' },
    });
    await this.reportsQueue.add('generate', { reportId: report.id, projectId });
    return report;
  }

  async findAll(userId: string, projectId: string) {
    await this.projectsService.findOwned(userId, projectId);
    return this.prisma.report.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findOne(userId: string, projectId: string, reportId: string) {
    const report = await this.findOwned(userId, projectId, reportId);
    if (report.status === 'completed' && report.fileUrl) {
      const downloadUrl = await this.s3Service.getDownloadUrl(report.fileUrl);
      return { ...report, downloadUrl };
    }
    return report;
  }

  async remove(userId: string, projectId: string, reportId: string) {
    const report = await this.findOwned(userId, projectId, reportId);
    if (report.fileUrl) {
      await this.s3Service.deleteObject(report.fileUrl);
    }
    await this.prisma.report.delete({ where: { id: reportId } });
  }

  private async findOwned(userId: string, projectId: string, reportId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.projectId !== projectId) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }
}
