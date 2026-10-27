import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  requestReport(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.reportsService.requestReport(user.sub, projectId);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.reportsService.findAll(user.sub, projectId);
  }

  @Get(':reportId')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.reportsService.findOne(user.sub, projectId, reportId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':reportId')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.reportsService.remove(user.sub, projectId, reportId);
  }
}
