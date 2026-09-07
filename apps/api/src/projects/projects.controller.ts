import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(user.sub);
  }

  @Get(':projectId')
  findOne(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.findOne(user.sub, projectId);
  }

  @Get(':projectId/summary')
  getSummary(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.getSummary(user.sub, projectId);
  }

  @Patch(':projectId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.sub, projectId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':projectId')
  remove(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.remove(user.sub, projectId);
  }

  @Get(':projectId/members')
  listMembers(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.listMembers(user.sub, projectId);
  }

  @Post(':projectId/members')
  inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projectsService.inviteMember(user.sub, projectId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':projectId/members/:memberId')
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectsService.removeMember(user.sub, projectId, memberId);
  }
}
