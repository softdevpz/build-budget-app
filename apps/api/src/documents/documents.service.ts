import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { StagesService } from '../stages/stages.service';
import { S3Service } from '../storage/s3.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly stagesService: StagesService,
    private readonly s3Service: S3Service,
  ) {}

  async presignUpload(userId: string, projectId: string, dto: PresignUploadDto) {
    await this.projectsService.findOwned(userId, projectId);
    const key = `projects/${projectId}/documents/${randomUUID()}-${sanitizeFileName(dto.fileName)}`;
    const uploadUrl = await this.s3Service.getUploadUrl(key, dto.contentType);
    return { uploadUrl, key };
  }

  async confirmUpload(userId: string, projectId: string, dto: ConfirmUploadDto) {
    await this.projectsService.findOwned(userId, projectId);
    if (dto.stageId) {
      await this.stagesService.findOwned(userId, projectId, dto.stageId);
    }
    return this.prisma.document.create({
      data: { projectId, stageId: dto.stageId, type: dto.type, fileUrl: dto.key },
    });
  }

  async findAll(userId: string, projectId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const documents = await this.prisma.document.findMany({
      where: { projectId },
      orderBy: { uploadedAt: 'desc' },
    });
    return Promise.all(
      documents.map(async (document) => ({
        ...document,
        downloadUrl: await this.s3Service.getDownloadUrl(document.fileUrl),
      })),
    );
  }

  async remove(userId: string, projectId: string, documentId: string) {
    const document = await this.findOwned(userId, projectId, documentId);
    await this.s3Service.deleteObject(document.fileUrl);
    await this.prisma.document.delete({ where: { id: documentId } });
  }

  private async findOwned(userId: string, projectId: string, documentId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.projectId !== projectId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }
}
