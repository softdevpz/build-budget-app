import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { StagesService } from '../stages/stages.service';
import { S3Service } from '../storage/s3.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly stagesService: StagesService,
    private readonly s3Service: S3Service,
  ) {}

  async create(userId: string, projectId: string, dto: CreateDiaryEntryDto) {
    await this.projectsService.findOwned(userId, projectId);
    if (dto.stageId) {
      await this.stagesService.findOwned(userId, projectId, dto.stageId);
    }
    return this.prisma.diaryEntry.create({
      data: { projectId, stageId: dto.stageId, authorId: userId, text: dto.text },
      include: { author: { select: { email: true } } },
    });
  }

  async findAll(userId: string, projectId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const entries = await this.prisma.diaryEntry.findMany({
      where: { projectId },
      include: { author: { select: { email: true } }, photos: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        photos: await Promise.all(
          entry.photos.map(async (photo) => ({
            ...photo,
            downloadUrl: await this.s3Service.getDownloadUrl(photo.fileUrl),
          })),
        ),
      })),
    );
  }

  async remove(userId: string, projectId: string, entryId: string) {
    await this.projectsService.findOwned(userId, projectId);
    const entry = await this.prisma.diaryEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.projectId !== projectId) {
      throw new NotFoundException('Diary entry not found');
    }
    await this.prisma.diaryEntry.delete({ where: { id: entryId } });
  }
}
