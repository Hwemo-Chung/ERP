import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  WsEventType,
  WsEvent,
  WsClientEventType,
  WsSubscribeBranchPayload,
  WsSubscribeOrderPayload,
  WsConnectedPayload,
  WsErrorPayload,
  WsOrderUpdatedPayload,
  WsAssignmentChangedPayload,
  WsNotificationPayload,
  WsForceRefreshPayload,
  WsSettlementPayload,
} from './interfaces/ws-event.interface';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
  connectionId?: string;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds as per architecture doc

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connectionIds
  private branchSubscriptions: Map<string, Set<string>> = new Map(); // branchCode -> Set of connectionIds
  private orderSubscriptions: Map<string, Set<string>> = new Map(); // orderId -> Set of connectionIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT from handshake
      const token = this.extractToken(client);
      if (!token) {
        this.sendError(client, 'E1002', 'error.token_required');
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.sendError(client, 'E1002', 'error.token_invalid');
        client.disconnect();
        return;
      }

      // Store user info on socket
      client.user = payload;
      client.connectionId = this.generateConnectionId();

      // Track connection
      this.connectedClients.set(client.connectionId, client);

      // Track user connections
      if (!this.userConnections.has(payload.sub)) {
        this.userConnections.set(payload.sub, new Set());
      }
      this.userConnections.get(payload.sub)!.add(client.connectionId);

      // Auto-subscribe to user's branch if available
      if (payload.branchCode) {
        this.subscribeToBranch(client, payload.branchCode);
      }

      // Send connected event
      const connectedPayload: WsConnectedPayload = {
        connectionId: client.connectionId,
        serverTime: new Date().toISOString(),
        heartbeatInterval: HEARTBEAT_INTERVAL,
      };
      client.emit(WsEventType.CONNECTED, connectedPayload);

      this.logger.log(
        `Client connected: ${client.connectionId} (user: ${payload.username})`,
      );
    } catch (error) {
      this.logger.error('Connection error:', error);
      this.sendError(client, 'E5001', 'error.connection_failed');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.connectionId) return;

    // Remove from connected clients
    this.connectedClients.delete(client.connectionId);

    // Remove from user connections
    if (client.user?.sub) {
      const userConns = this.userConnections.get(client.user.sub);
      if (userConns) {
        userConns.delete(client.connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(client.user.sub);
        }
      }
    }

    // Remove from branch subscriptions
    for (const [branchCode, connections] of this.branchSubscriptions) {
      connections.delete(client.connectionId);
      if (connections.size === 0) {
        this.branchSubscriptions.delete(branchCode);
      }
    }

    // Remove from order subscriptions
    for (const [orderId, connections] of this.orderSubscriptions) {
      connections.delete(client.connectionId);
      if (connections.size === 0) {
        this.orderSubscriptions.delete(orderId);
      }
    }

    this.logger.log(
      `Client disconnected: ${client.connectionId} (user: ${client.user?.username || 'unknown'})`,
    );
  }

  @SubscribeMessage(WsClientEventType.PING)
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): string {
    return 'pong';
  }

  @SubscribeMessage(WsClientEventType.SUBSCRIBE_BRANCH)
  handleSubscribeBranch(
    @MessageBody() data: WsSubscribeBranchPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): { success: boolean; branchCode: string } {
    if (!client.connectionId || !client.user) {
      throw new WsException('error.not_authenticated');
    }

    // Validate branch access (HQ_ADMIN can access all, others only their branch)
    if (
      !client.user.roles.includes('HQ_ADMIN') &&
      client.user.branchCode !== data.branchCode
    ) {
      throw new WsException('error.branch_access_denied');
    }

    this.subscribeToBranch(client, data.branchCode);
    return { success: true, branchCode: data.branchCode };
  }

  @SubscribeMessage(WsClientEventType.UNSUBSCRIBE_BRANCH)
  handleUnsubscribeBranch(
    @MessageBody() data: WsSubscribeBranchPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): { success: boolean; branchCode: string } {
    if (!client.connectionId) {
      throw new WsException('error.not_authenticated');
    }

    const connections = this.branchSubscriptions.get(data.branchCode);
    if (connections) {
      connections.delete(client.connectionId);
      client.leave(`branch:${data.branchCode}`);
    }

    return { success: true, branchCode: data.branchCode };
  }

  @SubscribeMessage(WsClientEventType.SUBSCRIBE_ORDER)
  handleSubscribeOrder(
    @MessageBody() data: WsSubscribeOrderPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): { success: boolean; orderId: string } {
    if (!client.connectionId || !client.user) {
      throw new WsException('error.not_authenticated');
    }

    if (!this.orderSubscriptions.has(data.orderId)) {
      this.orderSubscriptions.set(data.orderId, new Set());
    }
    this.orderSubscriptions.get(data.orderId)!.add(client.connectionId);
    client.join(`order:${data.orderId}`);

    return { success: true, orderId: data.orderId };
  }

  @SubscribeMessage(WsClientEventType.UNSUBSCRIBE_ORDER)
  handleUnsubscribeOrder(
    @MessageBody() data: WsSubscribeOrderPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): { success: boolean; orderId: string } {
    if (!client.connectionId) {
      throw new WsException('error.not_authenticated');
    }

    const connections = this.orderSubscriptions.get(data.orderId);
    if (connections) {
      connections.delete(client.connectionId);
      client.leave(`order:${data.orderId}`);
    }

    return { success: true, orderId: data.orderId };
  }

  // ============================================
  // Public methods for emitting events
  // ============================================

  /**
   * Emit order updated event to subscribed clients
   */
  emitOrderUpdated(branchCode: string, payload: WsOrderUpdatedPayload): void {
    this.server.to(`branch:${branchCode}`).emit(WsEventType.ORDER_UPDATED, payload);
    this.server.to(`order:${payload.orderId}`).emit(WsEventType.ORDER_UPDATED, payload);
    this.logger.debug(`Order updated event emitted: ${payload.orderId}`);
  }

  /**
   * Emit assignment changed event
   */
  emitAssignmentChanged(branchCode: string, payload: WsAssignmentChangedPayload): void {
    this.server.to(`branch:${branchCode}`).emit(WsEventType.ASSIGNMENT_CHANGED, payload);
    this.server.to(`order:${payload.orderId}`).emit(WsEventType.ASSIGNMENT_CHANGED, payload);
    this.logger.debug(`Assignment changed event emitted: ${payload.orderId}`);
  }

  /**
   * Emit notification to specific user
   */
  emitNotification(userId: string, payload: WsNotificationPayload): void {
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      for (const connId of userConns) {
        const client = this.connectedClients.get(connId);
        if (client) {
          client.emit(WsEventType.NOTIFICATION, payload);
        }
      }
      this.logger.debug(`Notification emitted to user: ${userId}`);
    }
  }

  /**
   * Emit force refresh event
   */
  emitForceRefresh(payload: WsForceRefreshPayload): void {
    if (payload.affectedBranchCodes?.length) {
      for (const branchCode of payload.affectedBranchCodes) {
        this.server.to(`branch:${branchCode}`).emit(WsEventType.FORCE_REFRESH, payload);
      }
    } else {
      this.server.emit(WsEventType.FORCE_REFRESH, payload);
    }
    this.logger.debug(`Force refresh event emitted: ${payload.reason}`);
  }

  /**
   * Emit settlement locked event
   */
  emitSettlementLocked(payload: WsSettlementPayload): void {
    this.server.to(`branch:${payload.branchCode}`).emit(WsEventType.SETTLEMENT_LOCKED, payload);
    this.logger.debug(`Settlement locked event emitted: ${payload.settlementId}`);
  }

  /**
   * Emit settlement unlocked event
   */
  emitSettlementUnlocked(payload: WsSettlementPayload): void {
    this.server.to(`branch:${payload.branchCode}`).emit(WsEventType.SETTLEMENT_UNLOCKED, payload);
    this.logger.debug(`Settlement unlocked event emitted: ${payload.settlementId}`);
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    branchSubscriptions: number;
    orderSubscriptions: number;
  } {
    return {
      totalConnections: this.connectedClients.size,
      uniqueUsers: this.userConnections.size,
      branchSubscriptions: this.branchSubscriptions.size,
      orderSubscriptions: this.orderSubscriptions.size,
    };
  }

  // ============================================
  // Private helper methods
  // ============================================

  private extractToken(client: Socket): string | null {
    // Try Sec-WebSocket-Protocol header first (as per architecture doc)
    const protocol = client.handshake.headers['sec-websocket-protocol'];
    if (protocol && typeof protocol === 'string') {
      const parts = protocol.split(',').map((p) => p.trim());
      const tokenPart = parts.find((p) => p.startsWith('bearer.'));
      if (tokenPart) {
        return tokenPart.replace('bearer.', '');
      }
    }

    // Fallback to auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Fallback to query parameter
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      return payload;
    } catch (error) {
      this.logger.warn('Token verification failed:', error);
      return null;
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private subscribeToBranch(client: AuthenticatedSocket, branchCode: string): void {
    if (!client.connectionId) return;

    if (!this.branchSubscriptions.has(branchCode)) {
      this.branchSubscriptions.set(branchCode, new Set());
    }
    this.branchSubscriptions.get(branchCode)!.add(client.connectionId);
    client.join(`branch:${branchCode}`);
  }

  private sendError(client: Socket, code: string, message: string): void {
    const errorPayload: WsErrorPayload = { code, message };
    client.emit(WsEventType.ERROR, errorPayload);
  }
}
