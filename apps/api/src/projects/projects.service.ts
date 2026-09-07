import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const limit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS]?.maxProjects ?? PLAN_LIMITS.free.maxProjects;
    const projectCount = await this.prisma.project.count({ where: { userId } });
    if (projectCount >= limit) {
      throw new HttpException(
        `Your ${user.plan} plan is limited to ${limit} project(s). Upgrade to Premium for more.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        address: dto.address,
        region: dto.region,
        areaM2: dto.areaM2,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetBudget: dto.targetBudget,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, projectId: string) {
    return this.findOwned(userId, projectId);
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOwned(userId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
  }

  async remove(userId: string, projectId: string) {
    await this.findOwned(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async getSummary(userId: string, projectId: string) {
    const project = await this.findOwned(userId, projectId);
    const [stages, expenses] = await Promise.all([
      this.prisma.stage.findMany({ where: { projectId } }),
      this.prisma.expense.findMany({ where: { projectId } }),
    ]);

    const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const stageSummaries = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      plannedBudget: stage.plannedBudget ? Number(stage.plannedBudget) : null,
      spent: expenses
        .filter((expense) => expense.stageId === stage.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    }));
    const unassignedSpent = expenses
      .filter((expense) => expense.stageId === null)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    return {
      targetBudget: project.targetBudget ? Number(project.targetBudget) : null,
      totalSpent,
      remaining: project.targetBudget ? Number(project.targetBudget) - totalSpent : null,
      stages: stageSummaries,
      unassignedSpent,
    };
  }

  /** Throws 404 for both "doesn't exist" and "not yours" so ownership isn't leaked. */
  async findOwned(userId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
