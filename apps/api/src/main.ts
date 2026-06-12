import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import * as winston from 'winston';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context }) => {
            return `${timestamp as string} [${level}] ${context ? `[${context as string}] ` : ''}${message as string}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ],
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
  }));
  app.use(compression());

  // CORS
  const isDev = configService.get<string>('NODE_ENV', 'development') === 'development';
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map(o => o.trim());
  const appLogger = new Logger('Bootstrap');
  appLogger.log(`CORS enabled for origins: ${corsOrigins.join(', ')}`);
  // Allow localhost AND private LAN ranges (10/8, 172.16/12, 192.168/16) so the
  // app can be opened by IP from phones/tablets on the factory network. The app
  // is single-origin behind nginx, so reflecting the request origin is safe here.
  const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
  const allowOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || LAN_ORIGIN.test(origin) || corsOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: origin ${origin} not allowed`));
  };
  void isDev;
  app.enableCors({
    origin: allowOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', '/api/v1');
  app.setGlobalPrefix(apiPrefix, { exclude: ['/health', '/metrics'] });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new AuditInterceptor(),
  );

  // Trust proxy
  app.set('trust proxy', 1);

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('STAR-MES Platform API')
    .setDescription(
      'Enterprise Manufacturing Execution System REST API. ' +
      'Provides endpoints for production, quality, maintenance, IIoT, and analytics.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Dashboard', 'Real-time operations dashboard')
    .addTag('Production', 'Production orders, batches, and OEE')
    .addTag('Quality', 'Quality management, NCR, CAPA, SPC')
    .addTag('Maintenance', 'CMMS/EAM work orders and assets')
    .addTag('IIoT', 'Industrial IoT devices and connectivity')
    .addTag('Reports', 'Reporting and analytics')
    .addTag('Users', 'User and role management')
    .addTag('Hierarchy', 'Plant hierarchy and equipment')
    .addServer(`http://localhost:${configService.get('API_PORT', '4001')}`, 'Development')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = configService.get<number>('API_PORT', 4001);
  await app.listen(port);

  appLogger.log(`🚀 STAR-MES API running on port ${port}`);
  appLogger.log(`📚 Swagger docs: http://localhost:${port}${apiPrefix}/docs`);
  appLogger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

void bootstrap();
