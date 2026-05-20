import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding INDUSTRY360 MES Platform...');

  // ---- Tenant ----
  const tenant = await prisma.tenant.upsert({
    where: { code: 'INDUSTRY360' },
    update: {},
    create: {
      code: 'INDUSTRY360',
      name: 'INDUSTRY360 Manufacturing Co.',
      industry: 'Food & Beverage',
      country: 'SA',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      language: 'en',
    },
  });
  console.log('✅ Tenant created:', tenant.name);

  // ---- Site ----
  const site = await prisma.site.upsert({
    where: { id: 'site-riyadh-01' },
    update: {},
    create: {
      id: 'site-riyadh-01',
      tenantId: tenant.id,
      code: 'RYD-PLANT-01',
      name: 'Riyadh Main Plant',
      country: 'SA',
      city: 'Riyadh',
      timezone: 'Asia/Riyadh',
    },
  });

  // ---- Areas ----
  const areas = await Promise.all([
    prisma.area.upsert({
      where: { id: 'area-mixing' },
      update: {},
      create: {
        id: 'area-mixing',
        tenantId: tenant.id,
        siteId: site.id,
        code: 'MIX',
        name: 'Mixing Area',
      },
    }),
    prisma.area.upsert({
      where: { id: 'area-filling' },
      update: {},
      create: {
        id: 'area-filling',
        tenantId: tenant.id,
        siteId: site.id,
        code: 'FIL',
        name: 'Filling Area',
      },
    }),
    prisma.area.upsert({
      where: { id: 'area-packaging' },
      update: {},
      create: {
        id: 'area-packaging',
        tenantId: tenant.id,
        siteId: site.id,
        code: 'PKG',
        name: 'Packaging Area',
      },
    }),
  ]);
  console.log('✅ Areas created');

  // ---- Equipment ----
  const equipmentData = [
    { id: 'eq-mixer-01', code: 'MIX-001', name: 'Mixer Line 1', type: 'MACHINE', areaId: areas[0].id, areaName: 'Mixing Area' },
    { id: 'eq-mixer-02', code: 'MIX-002', name: 'Mixer Line 2', type: 'MACHINE', areaId: areas[0].id, areaName: 'Mixing Area' },
    { id: 'eq-filler-01', code: 'FIL-001', name: 'Filler Line 1', type: 'PRODUCTION_LINE', areaId: areas[1].id, areaName: 'Filling Area' },
    { id: 'eq-filler-02', code: 'FIL-002', name: 'Filler Line 2', type: 'PRODUCTION_LINE', areaId: areas[1].id, areaName: 'Filling Area' },
    { id: 'eq-packer-01', code: 'PKG-001', name: 'Packaging Line 1', type: 'PRODUCTION_LINE', areaId: areas[2].id, areaName: 'Packaging Area' },
    { id: 'eq-packer-02', code: 'PKG-002', name: 'Packaging Line 2', type: 'PRODUCTION_LINE', areaId: areas[2].id, areaName: 'Packaging Area' },
    { id: 'eq-robot-01', code: 'ROB-001', name: 'Palletizing Robot', type: 'ROBOT', areaId: areas[2].id, areaName: 'Packaging Area' },
    { id: 'eq-conveyor-01', code: 'CVR-001', name: 'Main Conveyor', type: 'CONVEYOR', areaId: areas[1].id, areaName: 'Filling Area' },
  ];

  for (const eq of equipmentData) {
    await prisma.equipment.upsert({
      where: { id: eq.id },
      update: {},
      create: {
        id: eq.id,
        tenantId: tenant.id,
        siteId: site.id,
        areaId: eq.areaId,
        code: eq.code,
        name: eq.name,
        type: eq.type,
        areaName: eq.areaName,
        manufacturer: 'Siemens AG',
        criticality: 'HIGH',
      },
    });
  }

  // Equipment statuses
  const states = ['RUNNING', 'RUNNING', 'RUNNING', 'IDLE', 'RUNNING', 'FAULT', 'RUNNING', 'RUNNING'];
  for (let i = 0; i < equipmentData.length; i++) {
    const oee = 75 + Math.random() * 20;
    await prisma.equipmentStatus.upsert({
      where: { equipmentId: equipmentData[i].id },
      update: {
        state: states[i],
        oee: parseFloat(oee.toFixed(1)),
        availability: parseFloat((oee + 5).toFixed(1)),
        performance: parseFloat((oee + 10).toFixed(1)),
        quality: parseFloat((96 + Math.random() * 3).toFixed(1)),
        throughput: parseFloat((80 + Math.random() * 40).toFixed(0)),
        runtimeMinutes: parseFloat((240 + Math.random() * 200).toFixed(0)),
        updatedAt: new Date(),
      },
      create: {
        equipmentId: equipmentData[i].id,
        state: states[i],
        oee: parseFloat(oee.toFixed(1)),
        availability: parseFloat((oee + 5).toFixed(1)),
        performance: parseFloat((oee + 10).toFixed(1)),
        quality: parseFloat((96 + Math.random() * 3).toFixed(1)),
        throughput: parseFloat((80 + Math.random() * 40).toFixed(0)),
        runtimeMinutes: parseFloat((240 + Math.random() * 200).toFixed(0)),
      },
    });
  }
  console.log('✅ Equipment created');

  // ---- Permissions ----
  const permissionData = [
    { code: 'production:read', name: 'View Production', module: 'production' },
    { code: 'production:write', name: 'Manage Production', module: 'production' },
    { code: 'production:execute', name: 'Execute Production', module: 'production' },
    { code: 'quality:read', name: 'View Quality', module: 'quality' },
    { code: 'quality:write', name: 'Manage Quality', module: 'quality' },
    { code: 'maintenance:read', name: 'View Maintenance', module: 'maintenance' },
    { code: 'maintenance:write', name: 'Manage Maintenance', module: 'maintenance' },
    { code: 'reports:read', name: 'View Reports', module: 'reports' },
    { code: 'iot:read', name: 'View IIoT', module: 'iot' },
    { code: 'users:read', name: 'View Users', module: 'users' },
    { code: 'users:write', name: 'Manage Users', module: 'users' },
    { code: 'settings:write', name: 'Manage Settings', module: 'settings' },
  ];

  for (const perm of permissionData) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log('✅ Permissions created');

  // ---- Users ----
  const passwordHash = await bcrypt.hash('Password@123', 12);

  const users = [
    {
      id: 'user-super-admin',
      email: 'admin@industry360.sa',
      name: 'System Administrator',
      role: 'SUPER_ADMIN',
      department: 'IT',
    },
    {
      id: 'user-plant-mgr',
      email: 'soliman@industry360.sa',
      name: 'Soliman Al-Rashid',
      role: 'PLANT_MANAGER',
      department: 'Operations',
    },
    {
      id: 'user-prod-supervisor',
      email: 'production@industry360.sa',
      name: 'Mohammed Al-Zahrani',
      role: 'PRODUCTION_SUPERVISOR',
      department: 'Production',
    },
    {
      id: 'user-quality-eng',
      email: 'quality@industry360.sa',
      name: 'Fatima Al-Otaibi',
      role: 'QUALITY_ENGINEER',
      department: 'Quality',
    },
    {
      id: 'user-maintenance-tech',
      email: 'maintenance@industry360.sa',
      name: 'Khalid Al-Harbi',
      role: 'MAINTENANCE_TECHNICIAN',
      department: 'Maintenance',
    },
    {
      id: 'user-operator-01',
      email: 'operator@industry360.sa',
      name: 'Ali Hassan',
      role: 'OPERATOR',
      department: 'Production',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        tenantId: tenant.id,
        siteId: site.id,
        passwordHash,
        language: 'en',
        timezone: 'Asia/Riyadh',
      },
    });
  }
  console.log('✅ Users created');

  // ---- Products ----
  const products = [
    { id: 'prod-001', code: 'JUICE-001', name: 'Orange Juice 1L', category: 'Beverages', unit: 'L' },
    { id: 'prod-002', code: 'JUICE-002', name: 'Apple Juice 500ml', category: 'Beverages', unit: 'ML' },
    { id: 'prod-003', code: 'DAIRY-001', name: 'Milk 2% 1L', category: 'Dairy', unit: 'L' },
    { id: 'prod-004', code: 'WATER-001', name: 'Mineral Water 500ml', category: 'Water', unit: 'ML' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, tenantId: tenant.id },
    });
  }

  // ---- Work Orders (sample) ----
  const workOrderData = [
    {
      id: 'wo-2026-001', orderNumber: 'WO-20260515-0001',
      productId: 'prod-001', equipmentId: 'eq-filler-01',
      status: 'IN_PROGRESS', priority: 'HIGH', plannedQty: 5000, actualQty: 3200,
      plannedStart: new Date(Date.now() - 4 * 3600000), plannedEnd: new Date(Date.now() + 2 * 3600000),
      actualStart: new Date(Date.now() - 3.5 * 3600000),
    },
    {
      id: 'wo-2026-002', orderNumber: 'WO-20260515-0002',
      productId: 'prod-002', equipmentId: 'eq-filler-02',
      status: 'PLANNED', priority: 'MEDIUM', plannedQty: 8000, actualQty: null,
      plannedStart: new Date(Date.now() + 2 * 3600000), plannedEnd: new Date(Date.now() + 10 * 3600000),
    },
    {
      id: 'wo-2026-003', orderNumber: 'WO-20260514-0005',
      productId: 'prod-003', equipmentId: 'eq-mixer-01',
      status: 'COMPLETED', priority: 'LOW', plannedQty: 3000, actualQty: 2980,
      plannedStart: new Date(Date.now() - 24 * 3600000), plannedEnd: new Date(Date.now() - 18 * 3600000),
      actualStart: new Date(Date.now() - 23 * 3600000), actualEnd: new Date(Date.now() - 18.5 * 3600000),
    },
  ];

  for (const wo of workOrderData) {
    await prisma.workOrder.upsert({
      where: { id: wo.id },
      update: {},
      create: {
        ...wo,
        tenantId: tenant.id,
        createdById: 'user-prod-supervisor',
        assignedOperatorId: 'user-operator-01',
      } as Parameters<typeof prisma.workOrder.create>[0]['data'],
    });
  }
  console.log('✅ Work orders created');

  // ---- Alarms ----
  await prisma.alarm.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        code: 'ALM-001',
        description: 'Temperature threshold exceeded on Filler Line 1',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        category: 'PROCESS',
        equipmentId: 'eq-filler-01',
        value: 95.2,
        threshold: 80.0,
        triggeredAt: new Date(Date.now() - 15 * 60000),
      },
      {
        tenantId: tenant.id,
        code: 'ALM-002',
        description: 'Pressure low on Mixer Line 2',
        severity: 'HIGH',
        status: 'ACTIVE',
        category: 'EQUIPMENT',
        equipmentId: 'eq-mixer-02',
        value: 2.1,
        threshold: 4.0,
        triggeredAt: new Date(Date.now() - 45 * 60000),
      },
      {
        tenantId: tenant.id,
        code: 'ALM-003',
        description: 'Packaging Line 2 fault - conveyor jam',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        category: 'EQUIPMENT',
        equipmentId: 'eq-packer-02',
        triggeredAt: new Date(Date.now() - 8 * 60000),
      },
    ],
  });
  console.log('✅ Alarms created');

  // ---- NCRs ----
  await prisma.nonConformanceReport.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        ncrNumber: 'NCR-2026-001',
        title: 'Fill volume out of spec — Orange Juice 1L',
        description: 'Fill volume measured at 985ml, below minimum spec of 990ml',
        severity: 'MAJOR',
        status: 'OPEN',
        product: 'Orange Juice 1L',
        batchNumber: 'BTH-2026-0511',
        defectCategory: 'FILL_VOLUME',
        qty: 240,
        detectedBy: 'Fatima Al-Otaibi',
        detectedAt: new Date(Date.now() - 2 * 3600000),
        dueDate: new Date(Date.now() + 3 * 24 * 3600000),
      },
      {
        tenantId: tenant.id,
        ncrNumber: 'NCR-2026-002',
        title: 'Label misalignment — Apple Juice',
        description: 'Labels applied at +3mm offset from center',
        severity: 'MINOR',
        status: 'IN_REVIEW',
        product: 'Apple Juice 500ml',
        batchNumber: 'BTH-2026-0512',
        defectCategory: 'LABELING',
        qty: 120,
        detectedBy: 'Ali Hassan',
        detectedAt: new Date(Date.now() - 5 * 3600000),
        dueDate: new Date(Date.now() + 7 * 24 * 3600000),
      },
    ],
  });
  console.log('✅ NCRs created');

  // ---- Maintenance WOs ----
  await prisma.maintenanceWorkOrder.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        woNumber: 'MWO-2026-001',
        title: 'Replace hydraulic seal on Filler Line 1',
        description: 'Routine seal replacement per PM schedule',
        type: 'PREVENTIVE',
        priority: 'MEDIUM',
        status: 'ASSIGNED',
        equipmentId: 'eq-filler-01',
        assignedToId: 'user-maintenance-tech',
        estimatedHours: 4,
        dueDate: new Date(Date.now() + 2 * 24 * 3600000),
      },
      {
        tenantId: tenant.id,
        woNumber: 'MWO-2026-002',
        title: 'EMERGENCY: Packaging Line 2 conveyor jam',
        description: 'Conveyor jam reported by operator. Immediate intervention required.',
        type: 'EMERGENCY',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        equipmentId: 'eq-packer-02',
        assignedToId: 'user-maintenance-tech',
        estimatedHours: 2,
        startedAt: new Date(Date.now() - 30 * 60000),
        dueDate: new Date(Date.now() + 1 * 3600000),
      },
    ],
  });
  console.log('✅ Maintenance work orders created');

  // ---- Shifts ----
  await prisma.shift.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        name: 'Morning Shift',
        code: 'SHIFT-A',
        startTime: '06:00',
        endTime: '14:00',
        days: [1, 2, 3, 4, 5],
      },
      {
        tenantId: tenant.id,
        name: 'Afternoon Shift',
        code: 'SHIFT-B',
        startTime: '14:00',
        endTime: '22:00',
        days: [1, 2, 3, 4, 5],
      },
      {
        tenantId: tenant.id,
        name: 'Night Shift',
        code: 'SHIFT-C',
        startTime: '22:00',
        endTime: '06:00',
        days: [1, 2, 3, 4, 5, 6, 0],
      },
    ],
  });
  console.log('✅ Shifts created');

  // ---- IoT Devices ----
  await prisma.ioTDevice.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        equipmentId: 'eq-filler-01',
        name: 'Filler 1 PLC',
        deviceId: 'PLC-FIL-001',
        type: 'PLC',
        protocol: 'OPCUA',
        connectionString: 'opc.tcp://192.168.1.10:4840',
        status: 'CONNECTED',
        firmware: 'S7-1500 FW 2.9',
        lastSeenAt: new Date(),
      },
      {
        tenantId: tenant.id,
        equipmentId: 'eq-mixer-01',
        name: 'Mixer 1 PLC',
        deviceId: 'PLC-MIX-001',
        type: 'PLC',
        protocol: 'MODBUS',
        connectionString: '192.168.1.20:502',
        status: 'CONNECTED',
        lastSeenAt: new Date(),
      },
      {
        tenantId: tenant.id,
        name: 'MQTT Gateway',
        deviceId: 'GW-MQTT-001',
        type: 'GATEWAY',
        protocol: 'MQTT',
        connectionString: 'mqtt://192.168.1.100:1883',
        status: 'CONNECTED',
        lastSeenAt: new Date(),
      },
    ],
  });
  console.log('✅ IoT devices created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('───────────────────────────────');
  console.log('📧 Admin:    admin@industry360.sa / Password@123');
  console.log('📧 Manager:  soliman@industry360.sa / Password@123');
  console.log('📧 Operator: operator@industry360.sa / Password@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
