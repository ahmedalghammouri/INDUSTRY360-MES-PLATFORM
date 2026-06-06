import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  workOrder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sKU: { findFirst: jest.fn() },
  machine: { findFirst: jest.fn() },
  productionOrder: { findFirst: jest.fn() },
  machineCycleTime: { findFirst: jest.fn() },
  oEERecord: {
    aggregate: jest.fn().mockResolvedValue({ _avg: { oee: null, availability: null, performance: null, quality: null } }),
    create: jest.fn(),
  },
  downtimeEvent: { findMany: jest.fn().mockResolvedValue([]) },
  machineCurrentStatus: { upsert: jest.fn() },
  productionEvent: { create: jest.fn() },
};

const mockEventEmitter = { emit: jest.fn() };

describe('ProductionService', () => {
  let service: ProductionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        OEEService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  // ─── State Machine ────────────────────────────────────────

  describe('startWorkOrder', () => {
    it('transitions PLANNED → IN_PROGRESS', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', orderNumber: 'WO-2026060600-0001', status: 'PLANNED',
        machineId: 'm-1', skuId: 'sku-1', factoryId: 'f-1', plannedQty: 3000,
      });
      mockPrisma.workOrder.update.mockResolvedValueOnce({
        id: 'wo-1', orderNumber: 'WO-2026060600-0001', status: 'IN_PROGRESS',
        machineId: 'm-1', skuId: 'sku-1', factoryId: 'f-1',
        sku: { name: 'Big Betti 2L', code: 'BB2L' },
        machine: { name: 'Cartomac', code: 'CM-01' },
      });
      mockPrisma.machineCurrentStatus.upsert.mockResolvedValueOnce({});
      mockPrisma.productionEvent.create.mockResolvedValueOnce({});

      const result = await service.startWorkOrder('f-1', 'user-1', 'wo-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'production.work-order.started',
        expect.objectContaining({ factoryId: 'f-1' }),
      );
    });

    it('rejects starting a COMPLETED work order', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'COMPLETED', factoryId: 'f-1',
      });

      await expect(service.startWorkOrder('f-1', 'user-1', 'wo-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown WO', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce(null);
      await expect(service.startWorkOrder('f-1', 'user-1', 'unknown'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('holdWorkOrder', () => {
    it('transitions IN_PROGRESS → ON_HOLD', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'IN_PROGRESS', factoryId: 'f-1',
        machineId: 'm-1', skuId: 'sku-1', orderNumber: 'WO-001',
      });
      mockPrisma.workOrder.update.mockResolvedValueOnce({ id: 'wo-1', status: 'ON_HOLD' });
      mockPrisma.machineCurrentStatus.upsert.mockResolvedValueOnce({});
      mockPrisma.productionEvent.create.mockResolvedValueOnce({});

      const result = await service.holdWorkOrder('f-1', 'user-1', 'wo-1', {
        reason: 'Waiting for material',
      });
      expect(result.status).toBe('ON_HOLD');
    });

    it('rejects holding a PLANNED work order', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'PLANNED', factoryId: 'f-1',
      });
      await expect(service.holdWorkOrder('f-1', 'user-1', 'wo-1', { reason: 'test' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelWorkOrder', () => {
    it('cancels an IN_PROGRESS work order', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'IN_PROGRESS', factoryId: 'f-1',
        machineId: 'm-1', orderNumber: 'WO-001',
      });
      mockPrisma.workOrder.update.mockResolvedValueOnce({ id: 'wo-1', status: 'CANCELLED' });
      mockPrisma.machineCurrentStatus.upsert.mockResolvedValueOnce({});
      mockPrisma.productionEvent.create.mockResolvedValueOnce({});

      const result = await service.cancelWorkOrder('f-1', 'user-1', 'wo-1', 'SKU change');
      expect(result.status).toBe('CANCELLED');
    });

    it('cannot cancel a COMPLETED work order', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'COMPLETED', factoryId: 'f-1',
      });
      await expect(service.cancelWorkOrder('f-1', 'user-1', 'wo-1', 'reason'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── Count Recording ──────────────────────────────────────

  describe('recordCount', () => {
    it('increments actualQty and goodQty', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1', status: 'IN_PROGRESS', factoryId: 'f-1',
        goodQty: 200, reworkQty: 5, plannedQty: 3000, machineId: 'm-1', skuId: 'sku-1',
      });
      mockPrisma.workOrder.update.mockResolvedValueOnce({
        id: 'wo-1', actualQty: 350, goodQty: 350, reworkQty: 5,
      });
      mockPrisma.machineCurrentStatus.upsert.mockResolvedValueOnce({});
      mockPrisma.productionEvent.create.mockResolvedValueOnce({});

      const result = await service.recordCount('f-1', 'wo-1', { goodCount: 150, rejectCount: 0 });
      expect(result.actualQty).toBe(350);
      expect(result.goodQty).toBe(350);
    });

    it('rejects count update for non-IN_PROGRESS WO', async () => {
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce(null);
      await expect(service.recordCount('f-1', 'wo-1', { goodCount: 10 }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── KPIs ─────────────────────────────────────────────────

  describe('getKPIs', () => {
    it('returns KPI object with all required fields', async () => {
      mockPrisma.oEERecord.aggregate.mockResolvedValueOnce({
        _avg: { oee: 82.5, availability: 87.2, performance: 94.8, quality: 99.2 },
      });
      mockPrisma.workOrder.count.mockResolvedValue(50);

      const kpis = await service.getKPIs('f-1');
      expect(kpis).toHaveProperty('oee', 82.5);
      expect(kpis).toHaveProperty('availability', 87.2);
      expect(kpis).toHaveProperty('totalOrders');
      expect(kpis).toHaveProperty('inProgressOrders');
      expect(kpis).toHaveProperty('completedOrders');
    });
  });
});
