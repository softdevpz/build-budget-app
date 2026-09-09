import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { DiaryService } from './diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/diary')
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDiaryEntryDto,
  ) {
    return this.diaryService.create(user.sub, projectId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.diaryService.findAll(user.sub, projectId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':entryId')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.diaryService.remove(user.sub, projectId, entryId);
  }
}
