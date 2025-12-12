/**
 * WebSocket Gateway
 * Real-time event notifications for order updates, assignments, etc.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  branchCode?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private clients: Map<string, AuthenticatedSocket> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: No token`);
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.branchCode = payload.branchCode;

      this.clients.set(client.id, client);

      this.logger.log(
        `Client connected: ${client.id} (user: ${client.userId}, branch: ${client.branchCode})`,
      );

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to ERP WebSocket',
        clientId: client.id,
      });
    } catch (error) {
      this.logger.error(`Client ${client.id} authentication failed`, error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handle ping messages (heartbeat)
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  /**
   * Broadcast ORDER_UPDATED event
   */
  broadcastOrderUpdate(orderId: string, orderNo: string, newStatus: string) {
    this.server.emit('ORDER_UPDATED', {
      type: 'ORDER_UPDATED',
      payload: {
        orderId,
        orderNo,
        newStatus,
        timestamp: Date.now(),
      },
    });

    this.logger.debug(`Broadcasted ORDER_UPDATED: ${orderNo} -> ${newStatus}`);
  }

  /**
   * Broadcast ASSIGNMENT_CHANGED event
   */
  broadcastAssignmentChange(
    orderId: string,
    orderNo: string,
    installerId: string,
    installerName: string,
  ) {
    this.server.emit('ASSIGNMENT_CHANGED', {
      type: 'ASSIGNMENT_CHANGED',
      payload: {
        orderId,
        orderNo,
        installerId,
        installerName,
        timestamp: Date.now(),
      },
    });

    this.logger.debug(`Broadcasted ASSIGNMENT_CHANGED: ${orderNo} -> ${installerName}`);
  }

  /**
   * Send NOTIFICATION to specific user
   */
  sendNotificationToUser(
    userId: string,
    notification: {
      id: string;
      category: string;
      message: string;
    },
  ) {
    // Find all connections for this user
    const userClients = Array.from(this.clients.values()).filter(
      (client) => client.userId === userId,
    );

    userClients.forEach((client) => {
      client.emit('NOTIFICATION', {
        type: 'NOTIFICATION',
        payload: notification,
      });
    });

    this.logger.debug(`Sent NOTIFICATION to user ${userId}: ${notification.id}`);
  }

  /**
   * Broadcast FORCE_REFRESH event (e.g., settlement locked)
   */
  broadcastForceRefresh(reason: string, affectedBranches?: string[]) {
    const payload = {
      type: 'FORCE_REFRESH',
      payload: {
        reason,
        timestamp: Date.now(),
      },
    };

    if (affectedBranches && affectedBranches.length > 0) {
      // Send only to affected branches
      const affectedClients = Array.from(this.clients.values()).filter((client) =>
        affectedBranches.includes(client.branchCode || ''),
      );

      affectedClients.forEach((client) => {
        client.emit('FORCE_REFRESH', payload);
      });

      this.logger.debug(
        `Sent FORCE_REFRESH to ${affectedClients.length} clients in branches: ${affectedBranches.join(', ')}`,
      );
    } else {
      // Broadcast to all
      this.server.emit('FORCE_REFRESH', payload);
      this.logger.debug(`Broadcasted FORCE_REFRESH to all clients`);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
