import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ProjectsService } from '../projects/projects.service';
import { PROJECT_ACTIVITY_EVENT, ProjectActivityEvent } from '../common/project-activity.event';

function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

// Decorator arguments run at module-load time, before ConfigModule's dotenv
// loading — so this only sees a real WEB_APP_URL where the host (Railway)
// injects env vars directly into the process, not from a local .env file.
// The fallback keeps local dev working either way.
@WebSocketGateway({ cors: { origin: process.env.WEB_APP_URL ?? 'http://localhost:3000' } })
export class ProjectsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ProjectsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly projectsService: ProjectsService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    try {
      if (!token) throw new Error('No token provided');
      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;
    } catch {
      this.logger.warn(`Rejecting socket ${client.id}: invalid or missing token`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join-project')
  async handleJoinProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.emit('error', 'Not authenticated');
      return;
    }

    try {
      await this.projectsService.findOwned(userId, data.projectId);
    } catch {
      client.emit('error', 'Not authorized for this project');
      return;
    }

    await client.join(projectRoom(data.projectId));
    client.emit('joined-project', { projectId: data.projectId });
  }

  @OnEvent(PROJECT_ACTIVITY_EVENT)
  handleProjectActivity(event: ProjectActivityEvent) {
    this.server.to(projectRoom(event.projectId)).emit('project-activity', event);
  }
}
