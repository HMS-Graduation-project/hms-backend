import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  /**
   * When a client connects, extract the userId from handshake auth
   * or query params and join a user-specific room.
   */
  handleConnection(client: Socket) {
    const userId =
      (client.handshake.auth?.userId as string) ??
      (client.handshake.query?.userId as string);

    if (!userId) {
      this.logger.warn(
        `Client ${client.id} connected without userId — disconnecting`,
      );
      client.disconnect(true);
      return;
    }

    client.join(`user:${userId}`);
    this.logger.log(`Client ${client.id} joined room user:${userId}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Push a notification payload to a specific user's room.
   * Any connected socket for that user receives the event.
   */
  sendToUser(userId: string, notification: Record<string, unknown>) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
