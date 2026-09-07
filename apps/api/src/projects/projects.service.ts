import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

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
        members: { create: { userId, role: 'owner' } },
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
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
    await this.assertOwner(userId, projectId);
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

  async listMembers(userId: string, projectId: string) {
    await this.findOwned(userId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(userId: string, projectId: string, dto: InviteMemberDto) {
    await this.assertOwner(userId, projectId);

    const invitedUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!invitedUser) {
      throw new NotFoundException('No user with that email exists yet');
    }

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: invitedUser.id } },
      create: { projectId, userId: invitedUser.id, role: 'editor' },
      update: {},
      include: { user: { select: { email: true } } },
    });
  }

  async removeMember(userId: string, projectId: string, memberId: string) {
    await this.assertOwner(userId, projectId);

    const member = await this.prisma.projectMember.findUnique({ where: { id: memberId } });
    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === 'owner') {
      throw new ForbiddenException('Cannot remove the project owner');
    }

    await this.prisma.projectMember.delete({ where: { id: memberId } });
  }

  /** Throws 404 for both "doesn't exist" and "not a member" so it isn't leaked which projects exist. */
  async findOwned(userId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  /** Like findOwned, but also requires the "owner" role — for actions only the owner may take. */
  private async assertOwner(userId: string, projectId: string): Promise<void> {
    await this.findOwned(userId, projectId);
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (membership?.role !== 'owner') {
      throw new ForbiddenException('Only the project owner can do this');
    }
  }
}
