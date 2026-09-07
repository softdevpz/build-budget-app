import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsGateway } from './projects.gateway';

@Module({
  imports: [JwtModule.register({}), ProjectsModule],
  providers: [ProjectsGateway],
})
export class RealtimeModule {}
