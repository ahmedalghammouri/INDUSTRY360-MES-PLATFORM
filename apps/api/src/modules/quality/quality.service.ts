import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { NCRStatus, Severity, type Prisma } from '@prisma/client';
import {
  NCR_TRANSITIONS,
  type CreateInspectionDto,
  type UpdateInspectionDto,
  type CreateNCRDto,
  type UpdateNCRDto,
  type UpdateNCRStatusDto,
  type CreateCAPADto,
  type UpdateCAPADto,
  type AddCAPAActionDto,
  type VerifyCAPADto,
  type CreateQualityPlanDto,
  type UpdateQualityPlanDto,
  type CreateQualityParameterDto,
  type UpdateQualityParameterDto,
} from './dto/quality.dto';

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ────────────────────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────────────────────

  async getKPIs(factoryId: string | null) {
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    const factoryFilter = factoryId ? { factoryId } : {};

    const [inspections, openNCRs, criticalNCRs, totalCAPAs, openCAPAs] = await Promise.all([
      this.prisma.inspectionResult.findMany({
        where: { ...factoryFilter, inspectedAt: { gte: dayStart } },
      }),
      this.prisma.nCR.count({ where: { ...factoryFilter, status: NCRStatus.OPEN } }),
      this.prisma.nCR.count({
        where: { ...factoryFilter, status: NCRStatus.OPEN, severity: Severity.CRITICAL },
      }),
      this.prisma.cAPA.count({ where: { ...factoryFilter } }),
      this.prisma.cAPA.count({ where: { ...factoryFilter, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    const totalInspected = inspections.reduce((s, i) => s + i.totalQty, 0);
    const totalPassed = inspections.reduce((s, i) => s + i.passQty, 0);
    const fpy = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
    const reworkQty = inspections.reduce((s, i) => s + i.failQty, 0);

    return {
      fpy: parseFloat(fpy.toFixed(1)),
      passRate: parseFloat(fpy.toFixed(1)),
      reworkRate: totalInspected > 0 ? parseFloat(((reworkQty / totalInspected) * 100).toFixed(1)) : 0,
      scrapRate: 0,
      openNCRs,
      criticalNCRs,
      openCAPAs,
      capaComplianceRate: totalCAPAs > 0
        ? parseFloat((((totalCAPAs - openCAPAs) / totalCAPAs) * 100).toFixed(1))
        : 100,
      inspectionsToday: inspections.length,
      cpk: 1.45,
    };
  }

  // ────────────────────────────────────────────────────────────
  // INSPECTIONS
  // ────────────────────────────────────────────────────────────

  async createInspection(factoryId: string | null, userId: string, dto: CreateInspectionDto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    // Validate references
    if (dto.workOrderId) {
      const wo = await this.prisma.workOrder.findFirst({ where: { id: dto.workOrderId, ...factoryFilter } });
      if (!wo) throw new NotFoundException('Work order not found');
    }
    if (dto.machineId) {
      const m = await this.prisma.machine.findFirst({ where: { id: dto.machineId, ...factoryFilter } });
      if (!m) throw new NotFoundException('Machine not found');
    }

    const resolvedFactoryId = await this.resolveFactoryId(factoryId, dto.machineId, dto.workOrderId);
    const inspectionNumber = await this.generateInspectionNumber(resolvedFactoryId);

    const failQty = dto.failQty ?? (dto.totalQty - dto.passQty);
    const result = failQty === 0 ? 'PASS' : dto.passQty === 0 ? 'FAIL' : 'CONDITIONAL';

    const inspection = await this.prisma.inspectionResult.create({
      data: {
        factoryId: resolvedFactoryId,
        planId: dto.planId,
        workOrderId: dto.workOrderId,
        batchRecordId: dto.batchRecordId,
        machineId: dto.machineId,
        inspectionNumber,
        type: dto.type as any,
        result: result as any,
        totalQty: dto.totalQty,
        passQty: dto.passQty,
        failQty,
        measurements: dto.measurements as unknown as Prisma.InputJsonValue ?? undefined,
        inspectorId: userId,
        inspectedAt: dto.inspectedAt ? new Date(dto.inspectedAt) : new Date(),
        notes: dto.notes,
      },
      include: {
        inspector: { select: { name: true } },
        plan: { select: { name: true, code: true } },
        workOrder: { select: { orderNumber: true } },
        machine: { select: { name: true, code: true } },
      },
    });

    this.eventEmitter.emit('quality.inspection.created', {
      inspection,
      factoryId: resolvedFactoryId,
      result,
    });

    // Auto-create NCR if FAIL
    if (result === 'FAIL') {
      this.logger.warn(`Inspection ${inspectionNumber} FAILED — auto-NCR trigger recommended`);
      this.eventEmitter.emit('quality.inspection.failed', { inspection, factoryId: resolvedFactoryId });
    }

    return inspection;
  }

  async getInspectionById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const inspection = await this.prisma.inspectionResult.findFirst({
      where: { id, ...factoryFilter },
      include: {
        inspector: { select: { id: true, name: true } },
        plan: true,
        workOrder: { select: { id: true, orderNumber: true, status: true } },
        machine: { select: { id: true, name: true, code: true } },
        batchRecord: { select: { id: true, batchNumber: true } },
      },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  async updateInspection(factoryId: string | null, id: string, dto: UpdateInspectionDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const inspection = await this.prisma.inspectionResult.findFirst({
      where: { id, ...factoryFilter },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    const passQty = dto.passQty ?? inspection.passQty;
    const failQty = dto.failQty ?? inspection.failQty;
    const autoResult = failQty === 0 ? 'PASS' : passQty === 0 ? 'FAIL' : 'CONDITIONAL';

    return this.prisma.inspectionResult.update({
      where: { id },
      data: {
        ...(dto.result && { result: dto.result as any }),
        ...(!dto.result && { result: autoResult as any }),
        ...(dto.passQty !== undefined && { passQty }),
        ...(dto.failQty !== undefined && { failQty }),
        ...(dto.measurements && { measurements: dto.measurements as unknown as Prisma.InputJsonValue }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async findInspections(factoryId: string | null, filters: {
    search?: string;
    type?: string;
    result?: string;
    workOrderId?: string;
    machineId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, type, result, workOrderId, machineId, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(type && { type }),
      ...(result && { result }),
      ...(workOrderId && { workOrderId }),
      ...(machineId && { machineId }),
      ...(dateFrom && { inspectedAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { inspectedAt: { lte: new Date(dateTo) } }),
      ...(search && {
        OR: [
          { inspectionNumber: { contains: search, mode: 'insensitive' } },
          { machine: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.inspectionResult.count({ where }),
      this.prisma.inspectionResult.findMany({
        where,
        include: {
          inspector: { select: { name: true } },
          plan: { select: { name: true, code: true } },
          workOrder: { select: { orderNumber: true } },
          machine: { select: { name: true, code: true } },
        },
        orderBy: { inspectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((i) => ({
        id: i.id,
        inspectionNumber: i.inspectionNumber,
        type: i.type,
        result: i.result,
        inspector: i.inspector.name,
        machine: i.machine?.name ?? null,
        workOrder: (i as any).workOrder?.orderNumber ?? null,
        planName: i.plan?.name ?? null,
        date: i.inspectedAt.toISOString(),
        passQty: i.passQty,
        failQty: i.failQty,
        totalQty: i.totalQty,
        fpy: i.totalQty > 0 ? parseFloat(((i.passQty / i.totalQty) * 100).toFixed(1)) : 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // NCRs
  // ────────────────────────────────────────────────────────────

  async createNCR(factoryId: string | null, userId: string, dto: CreateNCRDto) {
    const resolvedFactoryId = await this.resolveFactoryId(factoryId, dto.machineId);
    const ncrNumber = await this.generateNCRNumber(resolvedFactoryId);

    const ncr = await this.prisma.nCR.create({
      data: {
        factoryId: resolvedFactoryId,
        ncrNumber,
        title: dto.title,
        description: dto.description,
        severity: dto.severity as Severity,
        status: 'OPEN',
        skuId: dto.skuId,
        batchRecordId: dto.batchRecordId,
        machineId: dto.machineId,
        defectCategory: dto.defectCategory,
        defectCode: dto.defectCode,
        quantity: dto.quantity,
        disposition: dto.disposition,
        detectedById: userId,
        detectedAt: new Date(dto.detectedAt),
        dueDate: new Date(dto.dueDate),
      },
      include: {
        detectedBy: { select: { name: true } },
      },
    });

    this.eventEmitter.emit('quality.ncr.created', {
      ncr,
      factoryId: resolvedFactoryId,
    });

    if (dto.severity === 'CRITICAL') {
      this.eventEmitter.emit('quality.ncr.critical', { ncr, factoryId: resolvedFactoryId });
    }

    this.logger.log(`NCR ${ncrNumber} created (${dto.severity})`);
    return ncr;
  }

  async getNCRById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const ncr = await this.prisma.nCR.findFirst({
      where: { id, ...factoryFilter },
      include: {
        detectedBy: { select: { id: true, name: true } },
        capas: {
          include: {
            assignedTo: { select: { name: true } },
            actions: true,
          },
        },
      },
    });
    if (!ncr) throw new NotFoundException('NCR not found');
    return ncr;
  }

  async updateNCR(factoryId: string | null, id: string, dto: UpdateNCRDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const ncr = await this.prisma.nCR.findFirst({ where: { id, ...factoryFilter } });
    if (!ncr) throw new NotFoundException('NCR not found');
    if (ncr.status === 'CLOSED') throw new BadRequestException('Cannot update a closed NCR');

    return this.prisma.nCR.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.severity && { severity: dto.severity as Severity }),
        ...(dto.disposition && { disposition: dto.disposition }),
        ...(dto.rootCause !== undefined && { rootCause: dto.rootCause }),
        ...(dto.correctiveAction !== undefined && { correctiveAction: dto.correctiveAction }),
        ...(dto.preventiveAction !== undefined && { preventiveAction: dto.preventiveAction }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      },
    });
  }

  async updateNCRStatus(factoryId: string | null, id: string, userId: string, dto: UpdateNCRStatusDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const ncr = await this.prisma.nCR.findFirst({ where: { id, ...factoryFilter } });
    if (!ncr) throw new NotFoundException('NCR not found');

    const allowed = NCR_TRANSITIONS[ncr.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition NCR from ${ncr.status} to ${dto.status}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updates: any = { status: dto.status };
    if (dto.status === 'RESOLVED') {
      updates.resolvedAt = new Date();
      updates.resolvedById = userId;
    }
    if (dto.status === 'CLOSED') {
      updates.closedAt = new Date();
      updates.closedById = userId;
    }

    const updated = await this.prisma.nCR.update({ where: { id }, data: updates });

    this.eventEmitter.emit('quality.ncr.status-changed', {
      ncrId: id,
      ncrNumber: ncr.ncrNumber,
      from: ncr.status,
      to: dto.status,
      factoryId: ncr.factoryId,
    });

    return updated;
  }

  async findNCRs(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    severity?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, severity, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(status && { status: status as NCRStatus }),
      ...(severity && { severity: severity as Severity }),
      ...(dateFrom && { detectedAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { detectedAt: { lte: new Date(dateTo) } }),
      ...(search && {
        OR: [
          { ncrNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.nCR.count({ where }),
      this.prisma.nCR.findMany({
        where,
        include: {
          detectedBy: { select: { name: true } },
          capas: { select: { id: true, status: true } },
        },
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((n) => ({
        ...n,
        capaCount: n.capas.length,
        openCAPAs: n.capas.filter((c) => ['OPEN', 'IN_PROGRESS'].includes(c.status)).length,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // CAPAs
  // ────────────────────────────────────────────────────────────

  async createCAPA(factoryId: string | null, userId: string, dto: CreateCAPADto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    let resolvedFactoryId = factoryId;

    if (dto.ncrId) {
      const ncr = await this.prisma.nCR.findFirst({ where: { id: dto.ncrId, ...factoryFilter } });
      if (!ncr) throw new NotFoundException('NCR not found');
      resolvedFactoryId = ncr.factoryId;

      // Transition NCR to CAPA_PENDING
      if (ncr.status === 'IN_REVIEW' || ncr.status === 'OPEN') {
        await this.prisma.nCR.update({
          where: { id: dto.ncrId },
          data: { status: 'CAPA_PENDING' },
        });
      }
    }

    const finalFactoryId = resolvedFactoryId ?? await this.getDefaultFactoryId();
    const capaNumber = await this.generateCAPANumber(finalFactoryId);

    const capa = await this.prisma.cAPA.create({
      data: {
        factoryId: finalFactoryId,
        capaNumber,
        ncrId: dto.ncrId,
        type: dto.type as any,
        title: dto.title,
        description: dto.description,
        status: 'OPEN',
        priority: dto.priority as any,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        assignedTo: { select: { name: true, email: true } },
        ncr: { select: { ncrNumber: true, title: true } },
      },
    });

    this.eventEmitter.emit('quality.capa.created', { capa, factoryId: finalFactoryId });
    this.logger.log(`CAPA ${capaNumber} created (${dto.type})`);
    return capa;
  }

  async getCAPAById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({
      where: { id, ...factoryFilter },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        ncr: { select: { ncrNumber: true, title: true, severity: true } },
        actions: {
          include: { capa: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!capa) throw new NotFoundException('CAPA not found');
    return capa;
  }

  async updateCAPA(factoryId: string | null, id: string, dto: UpdateCAPADto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({ where: { id, ...factoryFilter } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status === 'CLOSED') throw new BadRequestException('Cannot update a closed CAPA');

    return this.prisma.cAPA.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.priority && { priority: dto.priority as any }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.effectiveness !== undefined && { effectiveness: dto.effectiveness }),
      },
    });
  }

  async findCAPAs(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    type?: string;
    ncrId?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, type, ncrId, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(status && { status }),
      ...(type && { type }),
      ...(ncrId && { ncrId }),
      ...(search && {
        OR: [
          { capaNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.cAPA.count({ where }),
      this.prisma.cAPA.findMany({
        where,
        include: {
          assignedTo: { select: { name: true } },
          ncr: { select: { ncrNumber: true } },
          actions: { select: { id: true, status: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((c) => ({
        ...c,
        totalActions: c.actions.length,
        completedActions: c.actions.filter((a) => a.status === 'COMPLETED').length,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addCAPAAction(factoryId: string | null, capaId: string, dto: AddCAPAActionDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({ where: { id: capaId, ...factoryFilter } });
    if (!capa) throw new NotFoundException('CAPA not found');

    // Move CAPA to IN_PROGRESS if still OPEN
    if (capa.status === 'OPEN') {
      await this.prisma.cAPA.update({ where: { id: capaId }, data: { status: 'IN_PROGRESS' } });
    }

    const action = await this.prisma.cAPAAction.create({
      data: {
        capaId,
        description: dto.description,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: 'OPEN',
      },
    });

    return action;
  }

  async completeCAPAAction(factoryId: string | null, capaId: string, actionId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({ where: { id: capaId, ...factoryFilter } });
    if (!capa) throw new NotFoundException('CAPA not found');

    const action = await this.prisma.cAPAAction.findFirst({
      where: { id: actionId, capaId },
    });
    if (!action) throw new NotFoundException('CAPA action not found');

    return this.prisma.cAPAAction.update({
      where: { id: actionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async verifyCAPA(factoryId: string | null, id: string, userId: string, dto: VerifyCAPADto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({
      where: { id, ...factoryFilter },
      include: { actions: true },
    });
    if (!capa) throw new NotFoundException('CAPA not found');

    const pendingActions = capa.actions.filter((a) => a.status !== 'COMPLETED');
    if (pendingActions.length > 0) {
      throw new BadRequestException(
        `Cannot verify CAPA: ${pendingActions.length} action(s) still pending`,
      );
    }

    const verified = await this.prisma.cAPA.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById: userId,
        effectiveness: dto.effectiveness,
      },
    });

    this.eventEmitter.emit('quality.capa.verified', { capa: verified, factoryId: capa.factoryId });
    return verified;
  }

  async closeCAPA(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({ where: { id, ...factoryFilter } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status !== 'VERIFIED') {
      throw new BadRequestException('CAPA must be verified before closing');
    }

    return this.prisma.cAPA.update({
      where: { id },
      data: { status: 'CLOSED', completedAt: new Date() },
    });
  }

  // ────────────────────────────────────────────────────────────
  // DELETE OPERATIONS
  // ────────────────────────────────────────────────────────────

  async deleteCAPA(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const capa = await this.prisma.cAPA.findFirst({ where: { id, ...factoryFilter } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (!['OPEN', 'IN_PROGRESS'].includes(capa.status)) {
      throw new BadRequestException('Only open CAPAs can be deleted');
    }
    await this.prisma.cAPA.delete({ where: { id } });
  }

  async deleteNCR(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const ncr = await this.prisma.nCR.findFirst({ where: { id, ...factoryFilter } });
    if (!ncr) throw new NotFoundException('NCR not found');
    if (!['OPEN', 'IN_REVIEW'].includes(ncr.status)) {
      throw new BadRequestException('Only open NCRs can be deleted');
    }
    await this.prisma.nCR.delete({ where: { id } });
  }

  async deleteInspection(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const record = await this.prisma.inspectionResult.findFirst({ where: { id, ...factoryFilter } });
    if (!record) throw new NotFoundException('Inspection result not found');
    await this.prisma.inspectionResult.delete({ where: { id } });
  }

  // ────────────────────────────────────────────────────────────
  // QUALITY PLANS (ISA-95 QualityTest definitions)
  // ────────────────────────────────────────────────────────────

  async findQualityPlans(factoryId: string | null, filters: { skuId?: string; type?: string; isActive?: boolean }) {
    const where: any = {
      ...(factoryId ? { factoryId } : {}),
      ...(filters.skuId && { skuId: filters.skuId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : { isActive: true }),
    };
    const plans = await this.prisma.qualityPlan.findMany({
      where,
      include: {
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return plans;
  }

  async getInspectionsByWorkOrder(factoryId: string | null, workOrderId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    return this.prisma.inspectionResult.findMany({
      where: { workOrderId, ...factoryFilter },
      include: {
        inspector: { select: { name: true } },
        plan: { select: { name: true, code: true, type: true } },
      },
      orderBy: { inspectedAt: 'desc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // QUALITY PLAN CRUD (ISA-95 QualityTestSpecification)
  // ────────────────────────────────────────────────────────────

  async getQualityPlanById(factoryId: string | null, id: string) {
    const where = factoryId ? { id, factoryId } : { id };
    const plan = await this.prisma.qualityPlan.findFirst({
      where,
      include: {
        parameters: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { results: true } },
      },
    });
    if (!plan) throw new NotFoundException('Quality plan not found');
    return plan;
  }

  async createQualityPlan(factoryId: string, dto: CreateQualityPlanDto) {
    const existing = await this.prisma.qualityPlan.findFirst({
      where: { factoryId, code: dto.code.toUpperCase() },
    });
    if (existing) throw new BadRequestException(`Plan code '${dto.code}' already exists`);

    return this.prisma.qualityPlan.create({
      data: {
        factoryId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        type: dto.type,
        skuId: dto.skuId,
        machineId: dto.machineId,
        samplingFrequency: dto.samplingFrequency,
        samplingQty: dto.samplingQty ?? 1,
        version: dto.version ?? '1',
      },
      include: { parameters: true, _count: { select: { results: true } } },
    });
  }

  async updateQualityPlan(factoryId: string | null, id: string, dto: UpdateQualityPlanDto) {
    const where = factoryId ? { id, factoryId } : { id };
    const plan = await this.prisma.qualityPlan.findFirst({ where });
    if (!plan) throw new NotFoundException('Quality plan not found');

    return this.prisma.qualityPlan.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.skuId !== undefined && { skuId: dto.skuId || null }),
        ...(dto.machineId !== undefined && { machineId: dto.machineId || null }),
        ...(dto.samplingFrequency !== undefined && { samplingFrequency: dto.samplingFrequency || null }),
        ...(dto.samplingQty !== undefined && { samplingQty: dto.samplingQty }),
        ...(dto.version !== undefined && { version: dto.version }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { parameters: { orderBy: { sortOrder: 'asc' } }, _count: { select: { results: true } } },
    });
  }

  async deleteQualityPlan(factoryId: string | null, id: string) {
    const where = factoryId ? { id, factoryId } : { id };
    const plan = await this.prisma.qualityPlan.findFirst({
      where,
      include: { _count: { select: { results: true } } },
    });
    if (!plan) throw new NotFoundException('Quality plan not found');
    const resultCount = (plan as any)._count?.results ?? 0;
    if (resultCount > 0) {
      throw new BadRequestException(
        `Cannot delete a plan that has ${resultCount} inspection record(s). Deactivate it instead.`,
      );
    }
    await this.prisma.qualityPlan.delete({ where: { id } });
  }

  async approveQualityPlan(factoryId: string | null, id: string, userId: string) {
    const where = factoryId ? { id, factoryId } : { id };
    const plan = await this.prisma.qualityPlan.findFirst({ where });
    if (!plan) throw new NotFoundException('Quality plan not found');
    if (plan.approvedAt) throw new BadRequestException('Plan is already approved');

    return this.prisma.qualityPlan.update({
      where: { id },
      data: { approvedAt: new Date(), approvedById: userId },
      include: { parameters: { orderBy: { sortOrder: 'asc' } }, _count: { select: { results: true } } },
    });
  }

  // ────────────────────────────────────────────────────────────
  // QUALITY PARAMETERS (ISA-95 QualityTestSpecificationProperty)
  // ────────────────────────────────────────────────────────────

  async addParameter(factoryId: string | null, planId: string, dto: CreateQualityParameterDto) {
    const where = factoryId ? { id: planId, factoryId } : { id: planId };
    const plan = await this.prisma.qualityPlan.findFirst({ where });
    if (!plan) throw new NotFoundException('Quality plan not found');

    const last = await this.prisma.qualityParameter.findFirst({
      where: { planId },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.qualityParameter.create({
      data: {
        planId,
        name: dto.name,
        unit: dto.unit,
        nominalValue: dto.nominalValue,
        ucl: dto.ucl,
        lcl: dto.lcl,
        usl: dto.usl,
        lsl: dto.lsl,
        checkMethod: dto.checkMethod,
        isKPI: dto.isKPI ?? false,
        sortOrder: dto.sortOrder ?? (last ? last.sortOrder + 1 : 0),
      },
    });
  }

  async updateParameter(factoryId: string | null, planId: string, paramId: string, dto: UpdateQualityParameterDto) {
    const where = factoryId ? { id: planId, factoryId } : { id: planId };
    const plan = await this.prisma.qualityPlan.findFirst({ where });
    if (!plan) throw new NotFoundException('Quality plan not found');

    const param = await this.prisma.qualityParameter.findFirst({ where: { id: paramId, planId } });
    if (!param) throw new NotFoundException('Parameter not found');

    return this.prisma.qualityParameter.update({
      where: { id: paramId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit || null }),
        ...(dto.nominalValue !== undefined && { nominalValue: dto.nominalValue }),
        ...(dto.ucl !== undefined && { ucl: dto.ucl }),
        ...(dto.lcl !== undefined && { lcl: dto.lcl }),
        ...(dto.usl !== undefined && { usl: dto.usl }),
        ...(dto.lsl !== undefined && { lsl: dto.lsl }),
        ...(dto.checkMethod !== undefined && { checkMethod: dto.checkMethod || null }),
        ...(dto.isKPI !== undefined && { isKPI: dto.isKPI }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteParameter(factoryId: string | null, planId: string, paramId: string) {
    const where = factoryId ? { id: planId, factoryId } : { id: planId };
    const plan = await this.prisma.qualityPlan.findFirst({ where });
    if (!plan) throw new NotFoundException('Quality plan not found');

    const param = await this.prisma.qualityParameter.findFirst({ where: { id: paramId, planId } });
    if (!param) throw new NotFoundException('Parameter not found');

    await this.prisma.qualityParameter.delete({ where: { id: paramId } });
  }

  // ────────────────────────────────────────────────────────────
  // SPC — STATISTICAL PROCESS CONTROL
  // ────────────────────────────────────────────────────────────

  async getSPCParameters(factoryId: string | null, filters: { machineId?: string; skuId?: string }) {
    const where: any = {
      ...(factoryId ? { factoryId } : {}),
      ...(filters.machineId ? { machineId: filters.machineId } : {}),
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
    };

    const raw = await this.prisma.sPCMeasurement.groupBy({
      by: ['parameterName', 'parameterUnit', 'machineId'],
      where,
      _count: { value: true },
      _avg: { value: true, ucl: true, lcl: true, cl: true },
    });

    return raw.map(p => ({
      parameterName: p.parameterName,
      unit: p.parameterUnit,
      machineId: p.machineId,
      mean: p._avg.cl ?? p._avg.value,
      ucl: p._avg.ucl,
      lcl: p._avg.lcl,
      sampleCount: p._count.value,
    }));
  }

  async getSPCMeasurements(
    factoryId: string | null,
    filters: { parameterId?: string; machineId?: string; from?: string; to?: string; limit: number },
  ) {
    const where: any = {
      ...(factoryId ? { factoryId } : {}),
      ...(filters.machineId ? { machineId: filters.machineId } : {}),
      ...(filters.parameterId ? { parameterName: filters.parameterId } : {}),
      ...((filters.from || filters.to) ? {
        measuredAt: {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(filters.to) } : {}),
        },
      } : {}),
    };

    return this.prisma.sPCMeasurement.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      take: filters.limit,
      select: {
        id: true,
        parameterName: true,
        parameterUnit: true,
        value: true,
        machineId: true,
        ucl: true,
        lcl: true,
        cl: true,
        isOutOfControl: true,
        controlViolation: true,
        measuredAt: true,
        sampleSize: true,
        subgroupNumber: true,
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ────────────────────────────────────────────────────────────

  private async resolveFactoryId(
    factoryId: string | null,
    machineId?: string,
    workOrderId?: string,
  ): Promise<string> {
    if (factoryId) return factoryId;

    if (machineId) {
      const m = await this.prisma.machine.findUnique({ where: { id: machineId } });
      if (m) return m.factoryId;
    }
    if (workOrderId) {
      const wo = await this.prisma.workOrder.findUnique({ where: { id: workOrderId } });
      if (wo) return wo.factoryId;
    }
    return this.getDefaultFactoryId();
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new BadRequestException('No factory found — cannot create record');
    return factory.id;
  }

  private async generateInspectionNumber(factoryId: string): Promise<string> {
    const today = new Date();
    const prefix = `INS-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const last = await this.prisma.inspectionResult.findFirst({
      where: { factoryId, inspectionNumber: { startsWith: prefix } },
      orderBy: { inspectionNumber: 'desc' },
    });

    const seq = last ? parseInt(last.inspectionNumber.slice(-4), 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private async generateNCRNumber(factoryId: string): Promise<string> {
    const today = new Date();
    const prefix = `NCR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const last = await this.prisma.nCR.findFirst({
      where: { factoryId, ncrNumber: { startsWith: prefix } },
      orderBy: { ncrNumber: 'desc' },
    });

    const seq = last ? parseInt(last.ncrNumber.slice(-4), 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private async generateCAPANumber(factoryId: string): Promise<string> {
    const today = new Date();
    const prefix = `CAPA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const last = await this.prisma.cAPA.findFirst({
      where: { factoryId, capaNumber: { startsWith: prefix } },
      orderBy: { capaNumber: 'desc' },
    });

    const seq = last ? parseInt(last.capaNumber.slice(-4), 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}
