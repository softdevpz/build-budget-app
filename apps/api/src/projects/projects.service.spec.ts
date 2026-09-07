import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

function makePrismaMock() {
  return {
    user: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
    project: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    stage: { findMany: jest.fn() },
    expense: { findMany: jest.fn() },
  };
}

describe('ProjectsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProjectsService(prisma as any);
  });

  describe('create', () => {
    it('rejects a second project on the free plan with 402', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: 'free' });
      prisma.project.count.mockResolvedValue(1);

      await expect(service.create('user-1', { name: 'Second house' })).rejects.toThrow(HttpException);
      await expect(service.create('user-1', { name: 'Second house' })).rejects.toMatchObject({
        status: 402,
      });
      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it('allows the first project on the free plan and adds the creator as owner', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: 'free' });
      prisma.project.count.mockResolvedValue(0);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      await service.create('user-1', { name: 'First house' });

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            members: { create: { userId: 'user-1', role: 'owner' } },
          }),
        }),
      );
    });

    it('does not cap project count for the premium plan', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: 'premium' });
      prisma.project.count.mockResolvedValue(50);
      prisma.project.create.mockResolvedValue({ id: 'project-51' });

      await expect(service.create('user-1', { name: 'Yet another house' })).resolves.toBeDefined();
    });

    it('falls back to the free limit for an unrecognized plan value', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: 'not-a-real-plan' });
      prisma.project.count.mockResolvedValue(1);

      await expect(service.create('user-1', { name: 'Second house' })).rejects.toThrow(HttpException);
    });

    it('parses an explicit startDate', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: 'free' });
      prisma.project.count.mockResolvedValue(0);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      await service.create('user-1', { name: 'House', startDate: '2026-01-01' });

      const createArgs = prisma.project.create.mock.calls[0][0];
      expect(createArgs.data.startDate).toEqual(new Date('2026-01-01'));
    });
  });

  describe('findOne', () => {
    it('delegates to findOwned', async () => {
      const project = { id: 'project-1' };
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'editor' });

      await expect(service.findOne('member-1', 'project-1')).resolves.toBe(project);
    });
  });

  describe('findOwned', () => {
    it('throws 404 when the project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findOwned('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the caller is not a member (not just a 403)', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.findOwned('outsider', 'project-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the project when the caller is a member', async () => {
      const project = { id: 'project-1' };
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'editor' });

      await expect(service.findOwned('member-1', 'project-1')).resolves.toBe(project);
    });
  });

  describe('owner-only actions', () => {
    it('remove() rejects a non-owner member with 403', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'editor' });

      await expect(service.remove('editor-1', 'project-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });

    it('remove() succeeds for the owner', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });

      await service.remove('owner-1', 'project-1');

      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } });
    });

    it('inviteMember() rejects a non-owner member with 403', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'editor' });

      await expect(
        service.inviteMember('editor-1', 'project-1', { email: 'friend@example.com' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('lists only projects the user is a member of', () => {
      service.findAll('user-1');

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { members: { some: { userId: 'user-1' } } } }),
      );
    });
  });

  describe('update', () => {
    it('requires membership before updating', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.update('outsider', 'project-1', { name: 'New name' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('updates the project for a member', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'editor' });
      prisma.project.update.mockResolvedValue({ id: 'project-1', name: 'New name' });

      await service.update('member-1', 'project-1', { name: 'New name' });

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'project-1' } }),
      );
    });

    it('parses an explicit startDate on update', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
      prisma.project.update.mockResolvedValue({ id: 'project-1' });

      await service.update('owner-1', 'project-1', { startDate: '2026-02-01' });

      const updateArgs = prisma.project.update.mock.calls[0][0];
      expect(updateArgs.data.startDate).toEqual(new Date('2026-02-01'));
    });
  });

  describe('getSummary', () => {
    it('computes total spent, remaining budget, and a per-stage breakdown', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', targetBudget: 100000 });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
      prisma.stage.findMany.mockResolvedValue([{ id: 'stage-1', name: 'Fundamenty', plannedBudget: 50000 }]);
      prisma.expense.findMany.mockResolvedValue([
        { stageId: 'stage-1', amount: 20000 },
        { stageId: null, amount: 5000 },
      ]);

      const summary = await service.getSummary('owner-1', 'project-1');

      expect(summary).toEqual({
        targetBudget: 100000,
        totalSpent: 25000,
        remaining: 75000,
        stages: [{ id: 'stage-1', name: 'Fundamenty', plannedBudget: 50000, spent: 20000 }],
        unassignedSpent: 5000,
      });
    });

    it('reports null targetBudget/remaining and null plannedBudget when unset', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', targetBudget: null });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
      prisma.stage.findMany.mockResolvedValue([{ id: 'stage-1', name: 'Dach', plannedBudget: null }]);
      prisma.expense.findMany.mockResolvedValue([]);

      const summary = await service.getSummary('owner-1', 'project-1');

      expect(summary.targetBudget).toBeNull();
      expect(summary.remaining).toBeNull();
      expect(summary.stages[0].plannedBudget).toBeNull();
    });
  });

  describe('listMembers', () => {
    it('requires membership before listing', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.listMembers('outsider', 'project-1')).rejects.toThrow(NotFoundException);
    });

    it('returns members for a project the caller belongs to', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
      prisma.projectMember.findMany.mockResolvedValue([{ id: 'member-1', role: 'owner' }]);

      await expect(service.listMembers('owner-1', 'project-1')).resolves.toEqual([
        { id: 'member-1', role: 'owner' },
      ]);
    });
  });

  describe('inviteMember', () => {
    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
    });

    it('rejects inviting an email with no account yet', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteMember('owner-1', 'project-1', { email: 'ghost@example.com' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
    });

    it('adds the invited user as an editor', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'friend@example.com' });
      prisma.projectMember.upsert.mockResolvedValue({ id: 'member-2', role: 'editor' });

      await service.inviteMember('owner-1', 'project-1', { email: 'friend@example.com' });

      expect(prisma.projectMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { projectId: 'project-1', userId: 'user-2', role: 'editor' },
        }),
      );
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });
    });

    // Each removeMember() call makes 3 sequential projectMember.findUnique calls:
    // (1) findOwned's membership check, (2) assertOwner's role check, (3) the
    // target member lookup by memberId. mockResolvedValueOnce is queued to match.

    it('404s when the member does not belong to this project', async () => {
      prisma.projectMember.findUnique
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce(null);

      await expect(service.removeMember('owner-1', 'project-1', 'missing-member')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to remove the project owner', async () => {
      prisma.projectMember.findUnique
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce({ id: 'member-1', projectId: 'project-1', role: 'owner' });

      await expect(service.removeMember('owner-1', 'project-1', 'member-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    });

    it('removes a non-owner member', async () => {
      prisma.projectMember.findUnique
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce({ id: 'member-2', projectId: 'project-1', role: 'editor' });

      await service.removeMember('owner-1', 'project-1', 'member-2');

      expect(prisma.projectMember.delete).toHaveBeenCalledWith({ where: { id: 'member-2' } });
    });
  });
});
