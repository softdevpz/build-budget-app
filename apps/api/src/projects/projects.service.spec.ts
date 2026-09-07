import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

function makePrismaMock() {
  return {
    user: { findUniqueOrThrow: jest.fn() },
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
});
