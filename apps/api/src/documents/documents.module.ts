import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { StagesModule } from '../stages/stages.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [ProjectsModule, StagesModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
