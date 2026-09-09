import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { StagesModule } from '../stages/stages.module';
import { StorageModule } from '../storage/storage.module';
import { DiaryController } from './diary.controller';
import { DiaryService } from './diary.service';

@Module({
  imports: [ProjectsModule, StagesModule, StorageModule],
  controllers: [DiaryController],
  providers: [DiaryService],
})
export class DiaryModule {}
