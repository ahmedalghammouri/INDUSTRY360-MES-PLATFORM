import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProductionModule } from './modules/production/production.module';
import { QualityModule } from './modules/quality/quality.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { IotModule } from './modules/iot/iot.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { EnergyModule } from './modules/energy/energy.module';
import { WebSocketGatewayModule } from './gateways/websocket.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { configuration } from './config/configuration';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Throttler (rate limiting)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await import('cache-manager-ioredis-yet').then((m) => m.redisStore),
        url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        ttl: 60_000,
      }),
    }),

    // Bull Queue
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Event emitter
    EventEmitterModule.forRoot({ wildcard: true, delimiter: ':' }),

    // Core modules
    DatabaseModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    ProductionModule,
    QualityModule,
    MaintenanceModule,
    IotModule,
    ReportsModule,
    NotificationsModule,
    HierarchyModule,
    InventoryModule,
    EnergyModule,
    WebSocketGatewayModule,
    HealthModule,
  ],
  providers: [
    // Global guards
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Request logging middleware
  }
}
