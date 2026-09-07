import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { PROJECT_ACTIVITY_EVENT } from '../common/project-activity.event';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, projectId: string, dto: CreateStageDto) {
    await this.projectsService.findOwned(userId, projectId);
    const stage = await this.prisma.stage.create({
      data: { ...dto, projectId },
    });
    this.emit(projectId, 'stage.created', stage);
    return stage;
  }

  async findAll(userId: string, projectId: string) {
    await this.projectsService.findOwned(userId, projectId);
    return this.prisma.stage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: string, projectId: string, stageId: string) {
    return this.findOwned(userId, projectId, stageId);
  }

  async update(userId: string, projectId: string, stageId: string, dto: UpdateStageDto) {
    await this.findOwned(userId, projectId, stageId);
    const stage = await this.prisma.stage.update({ where: { id: stageId }, data: dto });
    this.emit(projectId, 'stage.updated', stage);
    return stage;
  }

  async remove(userId: string, projectId: string, stageId: string) {
    await this.findOwned(userId, projectId, stageId);
    await this.prisma.stage.delete({ where: { id: stageId } });
    this.emit(projectId, 'stage.deleted', { id: stageId });
  }

  /** Throws 404 if the project isn't owned by the user, or the stage doesn't belong to it. */
  async findOwned(userId: string, projectId: string, stageId: string): Promise<Stage> {
    await this.projectsService.findOwned(userId, projectId);
    const stage = await this.prisma.stage.findUnique({ where: { id: stageId } });
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Stage not found');
    }
    return stage;
  }

  private emit(projectId: string, type: string, payload: unknown) {
    this.eventEmitter.emit(PROJECT_ACTIVITY_EVENT, { projectId, type, payload });
  }
}
