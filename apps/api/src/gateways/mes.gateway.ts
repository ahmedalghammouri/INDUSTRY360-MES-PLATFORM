import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
})
export class MesWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MesWebSocketGateway.name);
  private readonly connectedClients = new Map<string, { userId: string; tenantId: string; socket: Socket }>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Heartbeat — push simulated real-time data every 5 seconds
    setInterval(() => this.broadcastRealtimeData(), 5000);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; tenantId: string }>(token);
      this.connectedClients.set(client.id, {
        userId: payload.sub,
        tenantId: payload.tenantId,
        socket: client,
      });

      // Join tenant room
      await client.join(`tenant:${payload.tenantId}`);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);

      client.emit('connected', {
        message: 'Connected to INDUSTRY360 MES real-time feed',
        timestamp: new Date().toISOString(),
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:equipment')
  handleEquipmentSubscription(
    @MessageBody() data: { equipmentIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    data.equipmentIds.forEach((id) => client.join(`equipment:${id}`));
    return { subscribed: data.equipmentIds };
  }

  @SubscribeMessage('subscribe:alarms')
  handleAlarmSubscription(@ConnectedSocket() client: Socket) {
    client.join('alarms:active');
    return { subscribed: 'alarms' };
  }

  // Broadcast production events
  @OnEvent('production.work-order.started')
  handleWorkOrderStarted(payload: { workOrder: { id: string; orderNumber: string }; tenantId: string }) {
    this.server.to(`tenant:${payload.tenantId}`).emit('production:work-order:started', {
      workOrderId: payload.workOrder.id,
      orderNumber: payload.workOrder.orderNumber,
      timestamp: new Date().toISOString(),
    });

    this.sendNotification(payload.tenantId, {
      title: 'Work Order Started',
      message: `Work order ${payload.workOrder.orderNumber} has started`,
      severity: 'info',
      category: 'production',
    });
  }

  @OnEvent('production.work-order.completed')
  handleWorkOrderCompleted(payload: { workOrder: { id: string; orderNumber: string }; tenantId: string }) {
    this.server.to(`tenant:${payload.tenantId}`).emit('production:work-order:completed', {
      workOrderId: payload.workOrder.id,
      orderNumber: payload.workOrder.orderNumber,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast KPI updates
  broadcastKPIs(tenantId: string, kpis: Record<string, number>) {
    this.server.to(`tenant:${tenantId}`).emit('dashboard:kpis', kpis);
  }

  // Broadcast machine status
  broadcastMachineStatus(tenantId: string, machines: unknown[]) {
    this.server.to(`tenant:${tenantId}`).emit('machines:status', machines);
  }

  // Broadcast alarm
  broadcastAlarm(tenantId: string, alarm: unknown) {
    this.server.to(`tenant:${tenantId}`).emit('alarm:triggered', alarm);
    this.server.to('alarms:active').emit('alarm:triggered', alarm);
  }

  sendNotification(tenantId: string, notification: {
    title: string;
    message: string;
    severity: string;
    category: string;
  }) {
    this.server.to(`tenant:${tenantId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  // Simulate real-time data
  private broadcastRealtimeData() {
    const mockKPIs = {
      oee: 80 + Math.random() * 10,
      availability: 85 + Math.random() * 8,
      performance: 90 + Math.random() * 8,
      quality: 97 + Math.random() * 2.5,
    };

    // Broadcast to all connected tenants
    this.connectedClients.forEach(({ tenantId }) => {
      this.server.to(`tenant:${tenantId}`).emit('dashboard:kpis', mockKPIs);
    });
  }

  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
