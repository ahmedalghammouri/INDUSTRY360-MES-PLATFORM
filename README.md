# INDUSTRY360 MES Platform

Enterprise Manufacturing Execution System — ISA-95 compliant, multi-tenant, real-time.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS, ECharts |
| Backend | NestJS 10, TypeScript, Prisma ORM, Socket.IO |
| Database | PostgreSQL 16, Redis 7, InfluxDB 2.7 |
| IIoT | MQTT, OPC-UA, Modbus TCP |
| Infrastructure | Docker, Nginx, GitHub Actions CI/CD |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure services
docker-compose up -d postgres redis influxdb mosquitto

# Run database migrations + seed
pnpm db:migrate
pnpm db:seed

# Start all apps in dev mode
pnpm dev
```

**Default credentials:** `admin@industry360.sa` / `Password@123`

- Web: http://localhost:4000
- API: http://localhost:4001/api/v1
- Swagger: http://localhost:4001/api/v1/docs

### Production Deployment

```bash
# Build Docker images
docker build -t mes-api ./apps/api --target production
docker build -t mes-web ./apps/web --target production

# Deploy with production compose
docker-compose -f docker-compose.prod.yml up -d
```

## Project Structure

```
INDUSTRY360 MES PLATFORM/
├── apps/
│   ├── api/          # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/     # Feature modules
│   │   │   ├── common/      # Guards, interceptors, decorators
│   │   │   ├── gateways/    # WebSocket gateway
│   │   │   └── database/    # Prisma service
│   │   └── prisma/          # Schema + migrations + seed
│   └── web/          # Next.js frontend
│       └── src/
│           ├── app/         # Next.js App Router pages
│           ├── components/  # Shared UI components
│           ├── features/    # Feature-specific views
│           ├── hooks/       # Custom React hooks
│           ├── services/    # API client services
│           └── store/       # Zustand state stores
├── packages/
│   ├── shared/       # Shared utilities and constants
│   └── types/        # Shared TypeScript types
└── infrastructure/
    ├── nginx/        # Nginx configuration
    ├── docker/       # Service configs (Mosquitto, PostgreSQL)
    └── monitoring/   # Prometheus configuration
```

## Modules

| Module | Description |
|--------|-------------|
| **Auth** | JWT auth, MFA (TOTP), RBAC, refresh token rotation |
| **Hierarchy** | ISA-95: Enterprise → Site → Area → WorkCell → Equipment |
| **Dashboard** | Real-time OEE, KPIs, machine status, alarms |
| **Production** | Work orders, OEE calculation, batch tracking |
| **Quality** | Inspections, NCR/CAPA, SPC charts |
| **Maintenance** | Work orders, PM scheduling, MTTR/MTBF |
| **IIoT** | Device management, live tag browser, MQTT/OPC-UA/Modbus |
| **Reports** | PDF/Excel report generation, scheduling |
| **AI** | Anomaly detection, predictive maintenance, optimization |
| **Notifications** | Real-time alerts, alarm management |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — Min 32 characters, use a cryptographically secure random string
- `JWT_REFRESH_SECRET` — Different from JWT_SECRET
- `NEXT_PUBLIC_API_URL` — Backend API URL for the frontend
