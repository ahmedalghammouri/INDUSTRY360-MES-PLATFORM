// ============================================================
// INDUSTRY360 MES Platform — Database Seed
// NCC (National Care Company) — Real Factory Data
// Based on NCC Prerequisites File & Requirements Matrix
// ============================================================

import { PrismaClient, UserRole, MachineType, Criticality, AreaType, LineType, DowntimeCategory, MaintType, EnergyType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding INDUSTRY360 MES Platform — NCC Group...\n');

  const passwordHash = await bcrypt.hash('Password@123', 12);

  // ============================================================
  // ENTERPRISE — National Care Company
  // ============================================================
  const enterprise = await prisma.enterprise.upsert({
    where: { code: 'NCC' },
    update: {},
    create: {
      code: 'NCC',
      name: 'National Care Company',
      nameAr: 'شركة الرعاية الوطنية',
      industry: 'FMCG — Detergents & Personal Care',
      country: 'SA',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      language: 'en',
    },
  });
  console.log(`✅ Enterprise: ${enterprise.name}`);

  // ============================================================
  // SUPER ADMIN USER
  // ============================================================
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@industry360.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: null,
      email: 'admin@industry360.sa',
      name: 'System Administrator',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      department: 'IT',
      jobTitle: 'Platform Administrator',
      language: 'en',
      timezone: 'Asia/Riyadh',
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email}`);

  const platformUser = await prisma.user.upsert({
    where: { email: 'soliman@industry360.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: null,
      email: 'soliman@industry360.sa',
      name: 'Soliman Al-Rashid',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      department: 'Operations',
      jobTitle: 'MES Platform Manager',
    },
  });
  console.log(`✅ Platform Manager: ${platformUser.email}`);

  // ============================================================
  // FACTORY 1 — SDPF (Saudi Detergent Powder Factory)
  // 3rd Industrial City, Dammam
  // ============================================================
  const sdpf = await prisma.factory.upsert({
    where: { code: 'SDPF' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      code: 'SDPF',
      name: 'Saudi Detergent Powder Factory',
      nameAr: 'مصنع المنظفات السعودية',
      city: 'Dammam',
      country: 'SA',
      address: '3rd Industrial City, Dammam, Eastern Province',
      lat: 26.25839228,
      lng: 49.99227038,
      color: '#00C8FF',
      glowColor: 'rgba(0,200,255,0.3)',
      timezone: 'Asia/Riyadh',
    },
  });

  // ============================================================
  // FACTORY 2 — SAF (Saudi Aerosol Factory)
  // 2nd Industrial City, Dammam
  // ============================================================
  const saf = await prisma.factory.upsert({
    where: { code: 'SAF' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      code: 'SAF',
      name: 'Saudi Aerosol Factory',
      nameAr: 'مصنع المنظفات الجوية',
      city: 'Dammam',
      country: 'SA',
      address: '2nd Industrial City, Dammam, Eastern Province',
      lat: 26.25466432,
      lng: 49.93058171,
      color: '#FF6B35',
      glowColor: 'rgba(255,107,53,0.3)',
      timezone: 'Asia/Riyadh',
    },
  });

  // ============================================================
  // FACTORY 3 — NDPF (National Detergent Powder Factory)
  // 2nd Industrial City, Dammam
  // ============================================================
  const ndpf = await prisma.factory.upsert({
    where: { code: 'NDPF' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      code: 'NDPF',
      name: 'National Detergent Powder Factory',
      nameAr: 'المصنع الوطني للمنظفات',
      city: 'Dammam',
      country: 'SA',
      address: '2nd Industrial City, Dammam, Eastern Province',
      lat: 26.25411750,
      lng: 49.98692510,
      color: '#9B59B6',
      glowColor: 'rgba(155,89,182,0.3)',
      timezone: 'Asia/Riyadh',
    },
  });

  // ============================================================
  // FACTORY 4 — SIDCO (Saudi Industrial Detergent Co.) — PoC FACTORY
  // 2nd Industrial City, Dammam
  // ============================================================
  const sidco = await prisma.factory.upsert({
    where: { code: 'SIDCO' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      code: 'SIDCO',
      name: 'Saudi Industrial Detergent Company',
      nameAr: 'الشركة السعودية الصناعية للمنظفات',
      city: 'Dammam',
      country: 'SA',
      address: '27th St, 2nd Industrial City, Dammam, Eastern Province',
      lat: 26.27130673,
      lng: 49.96291053,
      color: '#2ECC71',
      glowColor: 'rgba(46,204,113,0.3)',
      timezone: 'Asia/Riyadh',
    },
  });

  // ============================================================
  // FACTORY 5 — RNTIC (Plastic Blow Molding)
  // 1st Industrial City, Jeddah
  // ============================================================
  const rntic = await prisma.factory.upsert({
    where: { code: 'RNTIC' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      code: 'RNTIC',
      name: 'Plastic Blow Molding Manufacturing',
      nameAr: 'مصنع تشكيل البلاستيك بالنفخ',
      city: 'Jeddah',
      country: 'SA',
      address: '1st Industrial City, Jeddah, Western Province',
      lat: 21.43113428,
      lng: 39.20376108,
      color: '#E74C3C',
      glowColor: 'rgba(231,76,60,0.3)',
      timezone: 'Asia/Riyadh',
    },
  });

  console.log(`✅ Factories: SDPF, SAF, NDPF, SIDCO (PoC), RNTIC`);

  // ============================================================
  // SIDCO — AREAS (ISA-95 Level 3)
  // Based on Factory Automation Matrix: MAKING, PACKING, UTILITY
  // ============================================================
  const sidcoPackingArea = await prisma.area.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'PACKING' } },
    update: {},
    create: {
      factoryId: sidco.id,
      code: 'PACKING',
      name: 'Packing Area',
      nameAr: 'منطقة التعبئة',
      type: AreaType.PACKING,
    },
  });

  const sidcoMakingArea = await prisma.area.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'MAKING' } },
    update: {},
    create: {
      factoryId: sidco.id,
      code: 'MAKING',
      name: 'Making / Production Area',
      nameAr: 'منطقة الإنتاج',
      type: AreaType.MAKING,
    },
  });

  const sidcoUtilityArea = await prisma.area.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'UTILITY' } },
    update: {},
    create: {
      factoryId: sidco.id,
      code: 'UTILITY',
      name: 'Utility & Infrastructure',
      nameAr: 'منطقة المرافق',
      type: AreaType.UTILITY,
    },
  });

  // ============================================================
  // SIDCO — PRODUCTION LINE (Packing Line 1)
  // Based on Prerequisites: 5 machines in sequence
  // ============================================================
  const sidcoPackingLine1 = await prisma.productionLine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'PL-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      code: 'PL-01',
      name: 'Packing Line 1',
      nameAr: 'خط التعبئة 1',
      type: LineType.PACKING,
      sortOrder: 1,
    },
  });

  // ============================================================
  // SIDCO — MACHINES (ISA-95 Level 2)
  // Real NCC machine names from Prerequisites File
  // M1=Big Betti, M2=Cartomac, M3=Checkweigher, M4=Euro-Pack Robot, M5=Uni-tech Wrapping
  // ============================================================

  const bigBetti = await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'M1-BIG-BETTI' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      lineId: sidcoPackingLine1.id,
      code: 'M1-BIG-BETTI',
      name: 'Big Betti',
      nameAr: 'ماكينة بيج بيتي',
      sortOrder: 1,
      machineType: MachineType.FILLING_MACHINE,
      manufacturer: 'Big Betti GmbH',
      criticality: Criticality.CRITICAL,
      designCapacity: 120,    // units per hour (approx based on cycle times)
      downtimeThreshold: 60,  // 1 minute = NCC spec
    },
  });

  const cartomac = await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'M2-CARTOMAC' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      lineId: sidcoPackingLine1.id,
      code: 'M2-CARTOMAC',
      name: 'Cartomac',
      nameAr: 'ماكينة كارتوماك',
      sortOrder: 2,
      machineType: MachineType.CARTONING_MACHINE,
      manufacturer: 'Cartomac S.r.l.',
      criticality: Criticality.CRITICAL,
      designCapacity: 45 * 2 * 60,  // 45 duplex/min = 5400 cartons/hr
      downtimeThreshold: 60,
    },
  });

  const checkweigher = await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'M3-CHECKWEIGHER' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      lineId: sidcoPackingLine1.id,
      code: 'M3-CHECKWEIGHER',
      name: 'Checkweigher',
      nameAr: 'جهاز فحص الوزن',
      sortOrder: 3,
      machineType: MachineType.CHECKWEIGHER,
      criticality: Criticality.HIGH,
      downtimeThreshold: 60,
    },
  });

  const euroPackRobot = await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'M4-EURO-PACK' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      lineId: sidcoPackingLine1.id,
      code: 'M4-EURO-PACK',
      name: 'Euro-Pack Robot',
      nameAr: 'روبوت يورو-باك',
      sortOrder: 4,
      machineType: MachineType.ROBOT,
      manufacturer: 'Euro-Pack Systems',
      criticality: Criticality.HIGH,
      downtimeThreshold: 60,
    },
  });

  const unitechWrapping = await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'M5-UNITECH' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoPackingArea.id,
      lineId: sidcoPackingLine1.id,
      code: 'M5-UNITECH',
      name: 'Uni-tech Wrapping',
      nameAr: 'ماكينة يوني-تك للتغليف',
      sortOrder: 5,
      machineType: MachineType.WRAPPING_MACHINE,
      manufacturer: 'Uni-tech',
      criticality: Criticality.HIGH,
      downtimeThreshold: 60,
    },
  });

  // Utility machines
  await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'UTIL-BOILER-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoUtilityArea.id,
      code: 'UTIL-BOILER-01',
      name: 'Boiler',
      nameAr: 'غلاية البخار',
      sortOrder: 1,
      machineType: MachineType.BOILER,
      criticality: Criticality.CRITICAL,
    },
  });

  await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'UTIL-COMP-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoUtilityArea.id,
      code: 'UTIL-COMP-01',
      name: 'Compressor 1',
      nameAr: 'الضاغط 1',
      sortOrder: 2,
      machineType: MachineType.COMPRESSOR,
      criticality: Criticality.HIGH,
    },
  });

  await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'UTIL-COMP-02' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoUtilityArea.id,
      code: 'UTIL-COMP-02',
      name: 'Compressor 2',
      nameAr: 'الضاغط 2',
      sortOrder: 3,
      machineType: MachineType.COMPRESSOR,
      criticality: Criticality.HIGH,
    },
  });

  await prisma.machine.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'UTIL-TRANS-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      areaId: sidcoUtilityArea.id,
      code: 'UTIL-TRANS-01',
      name: 'ACB | Transformer 1',
      nameAr: 'محول الكهرباء 1',
      sortOrder: 4,
      machineType: MachineType.TRANSFORMER,
      criticality: Criticality.CRITICAL,
    },
  });

  console.log(`✅ SIDCO machines: Big Betti, Cartomac, Checkweigher, Euro-Pack Robot, Uni-tech, Utilities`);

  // Init machine status snapshots
  const machines = [bigBetti, cartomac, checkweigher, euroPackRobot, unitechWrapping];
  for (const m of machines) {
    await prisma.machineCurrentStatus.upsert({
      where: { machineId: m.id },
      update: {},
      create: {
        machineId: m.id,
        state: 'IDLE',
        goodCount: 0,
        rejectCount: 0,
        downtimeMinutes: 0,
        runtimeMinutes: 0,
      },
    });
  }

  // ============================================================
  // SIDCO — SHIFT TEMPLATES
  // From Prerequisites: 2 × 12-hour shifts, 11h production, 1h breaks
  // Shift 1: 07:30–19:30 | Shift 2: 19:30–07:30
  // Working days: Saturday–Thursday (days 0,1,2,3,4,6 in JS: 0=Sun)
  // ============================================================
  const shift1 = await prisma.shiftTemplate.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'SHIFT-A' } },
    update: {},
    create: {
      factoryId: sidco.id,
      code: 'SHIFT-A',
      name: 'Day Shift',
      nameAr: 'وردية الصباح',
      startTime: '07:30',
      endTime: '19:30',
      crossesMidnight: false,
      plannedProductionHours: 11.0,
      shiftDurationHours: 12.0,
      breakMinutes: 30,
      cleaningMinutes: 30,
      days: [0, 1, 2, 3, 4, 6], // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Sat=6
    },
  });

  const shift2 = await prisma.shiftTemplate.upsert({
    where: { factoryId_code: { factoryId: sidco.id, code: 'SHIFT-B' } },
    update: {},
    create: {
      factoryId: sidco.id,
      code: 'SHIFT-B',
      name: 'Night Shift',
      nameAr: 'وردية المساء',
      startTime: '19:30',
      endTime: '07:30',
      crossesMidnight: true,
      plannedProductionHours: 11.0,
      shiftDurationHours: 12.0,
      breakMinutes: 30,
      cleaningMinutes: 30,
      days: [0, 1, 2, 3, 4, 6],
    },
  });
  console.log(`✅ SIDCO shifts: Day (07:30-19:30), Night (19:30-07:30), 11h production / 12h total`);

  // ============================================================
  // SIDCO — SKUs / PRODUCTS
  // Real item numbers from NCC Prerequisites File
  // ============================================================
  const skuData = [
    // Alwatani brand
    { itemNumber: '10310064', name: 'Alwatani Powder Detergent - Violet HF', brand: 'Alwatani', category: 'Powder Detergent', weight: 2.0, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310067', name: 'Alwatani Powder Detergent - Blue HF', brand: 'Alwatani', category: 'Powder Detergent', weight: 2.0, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    // SIDCO Extra White
    { itemNumber: '10310110', name: 'SIDCO EXtra White - Original HF', brand: 'SIDCO Extra White', category: 'Powder Detergent', weight: 1.5, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310111', name: 'SIDCO EXtra White - Flower HF', brand: 'SIDCO Extra White', category: 'Powder Detergent', weight: 1.5, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310112', name: 'SIDCO EXtra White - Jasmine HF', brand: 'SIDCO Extra White', category: 'Powder Detergent', weight: 1.5, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310113', name: 'SIDCO EXtra White - Original LF', brand: 'SIDCO Extra White', category: 'Powder Detergent', weight: 1.5, packagingType: 'LF', unitsPerInner: 6, innersPerCarton: 1 },
    // GENTO 2.25kg
    { itemNumber: '10310189', name: 'GENTO - Flower HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310190', name: 'GENTO - Oud HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310191', name: 'GENTO - Original HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310192', name: 'GENTO Green - Flower LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310193', name: 'GENTO Green - Oud LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310194', name: 'GENTO Green - Original LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310217', name: 'GENTO - Musk HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310218', name: 'GENTO - Elegant HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310219', name: 'GENTO Green - Musk LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310220', name: 'GENTO Green - Elegant LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310235', name: 'GENTO - Gold HF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310236', name: 'GENTO - Gold LF 2.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    // GENTO 1.25kg
    { itemNumber: '10310201', name: 'GENTO - Original HF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310202', name: 'GENTO - Flower HF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310203', name: 'GENTO - Oud HF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310204', name: 'GENTO - Original LF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'LF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310205', name: 'GENTO - Flower LF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'LF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310206', name: 'GENTO - Oud LF 1.25kg', brand: 'GENTO', category: 'Powder Detergent', weight: 1.25, packagingType: 'LF', unitsPerInner: 6, innersPerCarton: 1 },
    // Safe
    { itemNumber: '10310213', name: 'Safe - Flower HF 2.25kg', brand: 'Safe', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310214', name: 'Safe - Original HF 2.25kg', brand: 'Safe', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310215', name: 'Safe - Flower LF 2.25kg', brand: 'Safe', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310216', name: 'Safe - Original LF 2.25kg', brand: 'Safe', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    // Miza / Panda
    { itemNumber: '10310290', name: 'Miza (Panda) HF 2.25kg', brand: 'Miza', category: 'Powder Detergent', weight: 2.25, packagingType: 'HF', unitsPerInner: 4, innersPerCarton: 1 },
    { itemNumber: '10310291', name: 'Miza (Panda) LF 2.25kg', brand: 'Miza', category: 'Powder Detergent', weight: 2.25, packagingType: 'LF', unitsPerInner: 4, innersPerCarton: 1 },
    // Rex
    { itemNumber: '10310297', name: 'Rex HF 2.5kg', brand: 'Rex', category: 'Powder Detergent', weight: 2.5, packagingType: 'HF', unitsPerInner: 6, innersPerCarton: 1 },
    { itemNumber: '10310298', name: 'REX LF 2.5kg', brand: 'REX', category: 'Powder Detergent', weight: 2.5, packagingType: 'LF', unitsPerInner: 6, innersPerCarton: 1 },
  ];

  const skuMap: Record<string, string> = {};
  for (const s of skuData) {
    const sku = await prisma.sKU.upsert({
      where: { factoryId_itemNumber: { factoryId: sidco.id, itemNumber: s.itemNumber } },
      update: {},
      create: {
        factoryId: sidco.id,
        itemNumber: s.itemNumber,
        code: `SKU-${s.itemNumber}`,
        name: s.name,
        brand: s.brand,
        category: s.category,
        weight: s.weight,
        weightUnit: 'kg',
        packagingType: s.packagingType,
        unitsPerInner: s.unitsPerInner,
        innersPerCarton: s.innersPerCarton,
        cartonsPerPallet: 40,
        baseUnit: 'CARTON',
      },
    });
    skuMap[s.itemNumber] = sku.id;
  }
  console.log(`✅ SIDCO SKUs: ${skuData.length} products loaded`);

  // ============================================================
  // SIDCO — MACHINE CYCLE TIMES (from NCC Prerequisites)
  // Big Betti (M1): 1.5kg=30s, 2kg=31s, 2.25kg=35s per INNER
  // Cartomac (M2): 1.5kg=30s, 2kg=25s, 2.25kg=40s per CARTON
  // Euro-Pack Robot (M4): 1.5kg=7m50s, 2kg=4m50s, 2.25kg=4m35s per PALLET
  // Uni-tech Wrapping (M5): 1.5kg=2m50s, 2kg=2m25s, 2.25kg=2m30s per PALLET
  // ============================================================
  const weightGroups: Record<string, string[]> = {
    '1.5': ['10310110', '10310111', '10310112', '10310113', '10310201', '10310202', '10310203', '10310204', '10310205', '10310206'],
    '2.0': ['10310064', '10310067'],
    '2.25': ['10310189', '10310190', '10310191', '10310192', '10310193', '10310194', '10310213', '10310214', '10310215', '10310216', '10310217', '10310218', '10310219', '10310220', '10310235', '10310236', '10310290', '10310291'],
    '2.5': ['10310297', '10310298'],
  };

  // Big Betti cycle times (per INNER)
  const bigBettiCycles: Record<string, number> = { '1.5': 30, '2.0': 31, '2.25': 35, '2.5': 36 };
  // Cartomac cycle times (per CARTON) — 45 duplex/min = each carton ~1.33s but NCC gave: 1.5kg=30s, 2kg=25s, 2.25kg=40s
  const cartomacCycles: Record<string, number> = { '1.5': 30, '2.0': 25, '2.25': 40, '2.5': 30 };
  // Euro-Pack Robot (per PALLET in seconds)
  const euroPackCycles: Record<string, number> = { '1.5': 470, '2.0': 290, '2.25': 275, '2.5': 300 }; // 7m50s=470, 4m50s=290, 4m35s=275
  // Uni-tech Wrapping (per PALLET)
  const unitechCycles: Record<string, number> = { '1.5': 170, '2.0': 145, '2.25': 150, '2.5': 155 }; // 2m50s=170, 2m25s=145, 2m30s=150

  for (const [weight, itemNumbers] of Object.entries(weightGroups)) {
    for (const itemNo of itemNumbers) {
      const skuId = skuMap[itemNo];
      if (!skuId) continue;

      if (bigBettiCycles[weight]) {
        await prisma.machineCycleTime.upsert({
          where: { machineId_skuId_unitType: { machineId: bigBetti.id, skuId, unitType: 'INNER' } },
          update: {},
          create: { machineId: bigBetti.id, skuId, cycleTimeSeconds: bigBettiCycles[weight], unitType: 'INNER' },
        });
      }
      if (cartomacCycles[weight]) {
        await prisma.machineCycleTime.upsert({
          where: { machineId_skuId_unitType: { machineId: cartomac.id, skuId, unitType: 'CARTON' } },
          update: {},
          create: { machineId: cartomac.id, skuId, cycleTimeSeconds: cartomacCycles[weight], unitType: 'CARTON', maxSpeed: 45 * 2 },
        });
      }
      if (euroPackCycles[weight]) {
        await prisma.machineCycleTime.upsert({
          where: { machineId_skuId_unitType: { machineId: euroPackRobot.id, skuId, unitType: 'PALLET' } },
          update: {},
          create: { machineId: euroPackRobot.id, skuId, cycleTimeSeconds: euroPackCycles[weight], unitType: 'PALLET' },
        });
      }
      if (unitechCycles[weight]) {
        await prisma.machineCycleTime.upsert({
          where: { machineId_skuId_unitType: { machineId: unitechWrapping.id, skuId, unitType: 'PALLET' } },
          update: {},
          create: { machineId: unitechWrapping.id, skuId, cycleTimeSeconds: unitechCycles[weight], unitType: 'PALLET' },
        });
      }
    }
  }
  console.log(`✅ Cycle times loaded for all SKU × Machine combinations`);

  // ============================================================
  // SIDCO — DOWNTIME CAUSES (real NCC data per machine)
  // From Prerequisites File
  // ============================================================

  // Big Betti downtime causes
  const bigBettiCauses = [
    { code: 'BB-01', name: 'Piston for powder inlet gate', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-02', name: 'Screw piston for opening the powder inlet gate to the inner', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-03', name: 'Glue tank piston + internal board', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-04', name: 'Glue system complete nozzle', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-05', name: 'Inverter fault', category: DowntimeCategory.ELECTRICAL },
    { code: 'BB-06', name: 'Inner holder', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-07', name: 'Air pressure low', category: DowntimeCategory.UTILITY },
    { code: 'BB-08', name: 'Inner section cup', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-09', name: 'A/C failure', category: DowntimeCategory.UTILITY },
    { code: 'BB-10', name: 'Electrical problems', category: DowntimeCategory.ELECTRICAL },
    { code: 'BB-11', name: 'Electrical trip for checkweigher belt', category: DowntimeCategory.ELECTRICAL },
    { code: 'BB-12', name: 'Rollers drive the inner', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-13', name: 'Door sensors', category: DowntimeCategory.ELECTRICAL },
    { code: 'BB-14', name: 'Main power failure', category: DowntimeCategory.EXTERNAL },
    { code: 'BB-15', name: 'Chain failure', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-16', name: 'Powder shortage', category: DowntimeCategory.MATERIAL },
    { code: 'BB-17', name: 'Printer machine fault', category: DowntimeCategory.MECHANICAL },
    { code: 'BB-18', name: 'Packing material shortage', category: DowntimeCategory.MATERIAL },
  ];

  for (let i = 0; i < bigBettiCauses.length; i++) {
    const c = bigBettiCauses[i];
    await prisma.downtimeCause.upsert({
      where: { id: `dc-bb-${c.code}` },
      update: {},
      create: {
        id: `dc-bb-${c.code}`,
        factoryId: sidco.id,
        machineId: bigBetti.id,
        code: c.code,
        name: c.name,
        category: c.category,
        isPlanned: false,
        sortOrder: i + 1,
      },
    });
  }

  // Cartomac downtime causes
  const cartomacCauseData = [
    { code: 'CM-01', name: 'Cartomac machine - lower large piston', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-02', name: 'Carton section cup', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-03', name: 'Carton closing piston right & left', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-04', name: 'Fixing piston and fixing track', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-05', name: 'Glue tank piston + internal board', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-06', name: 'Glue system complete nozzle', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-07', name: 'A/C failure', category: DowntimeCategory.UTILITY },
    { code: 'CM-08', name: 'Door sensors', category: DowntimeCategory.ELECTRICAL },
    { code: 'CM-09', name: 'Chain failure', category: DowntimeCategory.MECHANICAL },
    { code: 'CM-10', name: 'Packing material shortage', category: DowntimeCategory.MATERIAL },
    { code: 'CM-11', name: 'Main power failure', category: DowntimeCategory.EXTERNAL },
    { code: 'CM-12', name: 'Air pressure low', category: DowntimeCategory.UTILITY },
    { code: 'CM-13', name: 'Electrical problems', category: DowntimeCategory.ELECTRICAL },
    { code: 'CM-14', name: 'Printer machine fault', category: DowntimeCategory.MECHANICAL },
  ];

  for (let i = 0; i < cartomacCauseData.length; i++) {
    const c = cartomacCauseData[i];
    await prisma.downtimeCause.upsert({
      where: { id: `dc-cm-${c.code}` },
      update: {},
      create: {
        id: `dc-cm-${c.code}`,
        factoryId: sidco.id,
        machineId: cartomac.id,
        code: c.code,
        name: c.name,
        category: c.category,
        isPlanned: false,
        sortOrder: i + 1,
      },
    });
  }

  // Euro-Pack Robot causes
  const euroPackCauseData = [
    { code: 'EP-01', name: 'Piston and arm for cutting the stretch roll', category: DowntimeCategory.MECHANICAL },
    { code: 'EP-02', name: 'Electrical trip for pallet wrapping rotating', category: DowntimeCategory.ELECTRICAL },
    { code: 'EP-03', name: 'A/C failure', category: DowntimeCategory.UTILITY },
    { code: 'EP-04', name: 'Chain failure', category: DowntimeCategory.MECHANICAL },
    { code: 'EP-05', name: 'Door sensors', category: DowntimeCategory.ELECTRICAL },
    { code: 'EP-06', name: 'Air pressure low', category: DowntimeCategory.UTILITY },
    { code: 'EP-07', name: 'Electrical problems', category: DowntimeCategory.ELECTRICAL },
    { code: 'EP-08', name: 'Main power failure', category: DowntimeCategory.EXTERNAL },
  ];

  for (let i = 0; i < euroPackCauseData.length; i++) {
    const c = euroPackCauseData[i];
    await prisma.downtimeCause.upsert({
      where: { id: `dc-ep-${c.code}` },
      update: {},
      create: {
        id: `dc-ep-${c.code}`,
        factoryId: sidco.id,
        machineId: euroPackRobot.id,
        code: c.code,
        name: c.name,
        category: c.category,
        isPlanned: false,
        sortOrder: i + 1,
      },
    });
  }

  // Planned downtime causes (common to all machines)
  const plannedCauses = [
    { code: 'PLN-01', name: 'Planned break', category: DowntimeCategory.PLANNED_BREAK, isPlanned: true },
    { code: 'PLN-02', name: 'Planned cleaning', category: DowntimeCategory.PLANNED_CLEANING, isPlanned: true },
    { code: 'PLN-03', name: 'Product changeover', category: DowntimeCategory.CHANGEOVER, isPlanned: true },
    { code: 'PLN-04', name: 'Preventive maintenance', category: DowntimeCategory.PLANNED_MAINTENANCE, isPlanned: true },
    { code: 'PLN-05', name: 'Scheduled shutdown', category: DowntimeCategory.PLANNED_MAINTENANCE, isPlanned: true },
  ];

  for (let i = 0; i < plannedCauses.length; i++) {
    const c = plannedCauses[i];
    await prisma.downtimeCause.upsert({
      where: { id: `dc-pln-${c.code}` },
      update: {},
      create: {
        id: `dc-pln-${c.code}`,
        factoryId: sidco.id,
        machineId: null,
        code: c.code,
        name: c.name,
        category: c.category,
        isPlanned: c.isPlanned,
        sortOrder: i + 1,
      },
    });
  }

  console.log(`✅ SIDCO downtime causes: Big Betti(18), Cartomac(14), Euro-Pack(8), Planned(5)`);

  // ============================================================
  // SIDCO — USERS (from NCC Prerequisites File)
  // ============================================================
  const issaMasadeh = await prisma.user.upsert({
    where: { email: 'issa.masadeh@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'issa.masadeh@sidco.com.sa',
      name: 'Issa Masadeh',
      passwordHash,
      role: UserRole.FACTORY_ADMIN,
      phone: '0539429752',
      jobTitle: 'Factory Administrator',
      department: 'Operations',
      notifyEmail: true,
    },
  });

  const mohammedBrakat = await prisma.user.upsert({
    where: { email: 'mohammed.brakat@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'mohammed.brakat@sidco.com.sa',
      name: 'Mohammed Brakat',
      passwordHash,
      role: UserRole.PLANT_MANAGER,
      jobTitle: 'Plant Manager',
      department: 'Operations',
      notifyEmail: true,
    },
  });

  const mohammedYousef = await prisma.user.upsert({
    where: { email: 'mohammed.yousef@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'mohammed.yousef@sidco.com.sa',
      name: 'Mohammed Yousef',
      passwordHash,
      role: UserRole.PRODUCTION_SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      notifyEmail: true,
    },
  });

  // Generic operator for SIDCO
  await prisma.user.upsert({
    where: { email: 'operator@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'operator@sidco.com.sa',
      name: 'Production Operator',
      passwordHash,
      role: UserRole.OPERATOR,
      jobTitle: 'Machine Operator',
      department: 'Production',
    },
  });

  // Maintenance user for SIDCO
  await prisma.user.upsert({
    where: { email: 'maintenance@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'maintenance@sidco.com.sa',
      name: 'Maintenance Technician',
      passwordHash,
      role: UserRole.MAINTENANCE_TECHNICIAN,
      jobTitle: 'Maintenance Technician',
      department: 'Maintenance',
    },
  });

  // Quality user for SIDCO
  await prisma.user.upsert({
    where: { email: 'quality@sidco.com.sa' },
    update: {},
    create: {
      enterpriseId: enterprise.id,
      factoryId: sidco.id,
      email: 'quality@sidco.com.sa',
      name: 'Quality Engineer',
      passwordHash,
      role: UserRole.QUALITY_ENGINEER,
      jobTitle: 'Quality Engineer',
      department: 'Quality',
    },
  });

  console.log(`✅ SIDCO users: Issa Masadeh (Admin), Mohammed Brakat (Manager), Mohammed Yousef (Supervisor) + Operator + Maintenance + Quality`);

  // ============================================================
  // SIDCO — SPARE PARTS (common parts from NCC downtime list)
  // ============================================================
  const spareParts = [
    { partNumber: 'SP-BB-001', name: 'Piston for powder inlet gate (Big Betti)', category: 'Pneumatic', machineCode: 'M1' },
    { partNumber: 'SP-BB-002', name: 'Glue tank piston + internal board', category: 'Pneumatic', machineCode: 'M1' },
    { partNumber: 'SP-BB-003', name: 'Glue system nozzle', category: 'Fluid System', machineCode: 'M1' },
    { partNumber: 'SP-BB-004', name: 'Inverter (Big Betti)', category: 'Electrical', machineCode: 'M1' },
    { partNumber: 'SP-BB-005', name: 'Inner section cup', category: 'Mechanical', machineCode: 'M1' },
    { partNumber: 'SP-CM-001', name: 'Cartomac lower large piston', category: 'Pneumatic', machineCode: 'M2' },
    { partNumber: 'SP-CM-002', name: 'Carton section cup', category: 'Mechanical', machineCode: 'M2' },
    { partNumber: 'SP-CM-003', name: 'Carton closing piston (right)', category: 'Pneumatic', machineCode: 'M2' },
    { partNumber: 'SP-CM-004', name: 'Carton closing piston (left)', category: 'Pneumatic', machineCode: 'M2' },
    { partNumber: 'SP-CM-005', name: 'Fixing piston', category: 'Pneumatic', machineCode: 'M2' },
    { partNumber: 'SP-EP-001', name: 'Stretch roll cutting arm piston', category: 'Pneumatic', machineCode: 'M4' },
    { partNumber: 'SP-COMMON-001', name: 'Door sensor switch', category: 'Electrical', machineCode: null },
    { partNumber: 'SP-COMMON-002', name: 'Drive chain (standard)', category: 'Mechanical', machineCode: null },
    { partNumber: 'SP-COMMON-003', name: 'Air filter element', category: 'Pneumatic', machineCode: null },
  ];

  for (const sp of spareParts) {
    await prisma.sparePart.upsert({
      where: { factoryId_partNumber: { factoryId: sidco.id, partNumber: sp.partNumber } },
      update: {},
      create: {
        factoryId: sidco.id,
        partNumber: sp.partNumber,
        name: sp.name,
        category: sp.category,
        stockQty: 2,
        minStockQty: 1,
        storageLocation: 'SIDCO-STORE-A',
      },
    });
  }
  console.log(`✅ SIDCO spare parts: ${spareParts.length} items`);

  // ============================================================
  // SIDCO — ENERGY METERS
  // ============================================================
  await prisma.energyMeter.upsert({
    where: { factoryId_meterNumber: { factoryId: sidco.id, meterNumber: 'EM-MAIN-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      meterNumber: 'EM-MAIN-01',
      name: 'Main Electrical Meter',
      type: EnergyType.ELECTRICAL,
      unit: 'kWh',
      location: 'LV Switchgear Room',
    },
  });

  await prisma.energyMeter.upsert({
    where: { factoryId_meterNumber: { factoryId: sidco.id, meterNumber: 'EM-COMP-01' } },
    update: {},
    create: {
      factoryId: sidco.id,
      meterNumber: 'EM-COMP-01',
      name: 'Compressed Air Meter',
      type: EnergyType.COMPRESSED_AIR,
      unit: 'm3',
      location: 'Utility Area',
    },
  });
  console.log(`✅ SIDCO energy meters loaded`);

  // ============================================================
  // SIDCO — NOTIFICATION RULES
  // ============================================================
  await prisma.notificationRule.upsert({
    where: { id: 'nr-sidco-downtime' },
    update: {},
    create: {
      id: 'nr-sidco-downtime',
      factoryId: sidco.id,
      name: 'Machine Downtime Alert',
      module: 'production',
      event: 'DOWNTIME_START',
      condition: { durationThreshold: 60 },
      channels: { email: true, whatsapp: false, sms: false },
      recipients: { roles: ['FACTORY_ADMIN', 'PLANT_MANAGER', 'PRODUCTION_SUPERVISOR'] },
      isActive: true,
    },
  });

  await prisma.notificationRule.upsert({
    where: { id: 'nr-sidco-oee' },
    update: {},
    create: {
      id: 'nr-sidco-oee',
      factoryId: sidco.id,
      name: 'Low OEE Alert',
      module: 'production',
      event: 'OEE_BELOW_THRESHOLD',
      condition: { threshold: 65 },
      channels: { email: true, whatsapp: false, sms: false },
      recipients: { roles: ['FACTORY_ADMIN', 'PLANT_MANAGER'] },
      isActive: true,
    },
  });
  console.log(`✅ SIDCO notification rules loaded`);

  // ============================================================
  // SDPF — Basic Structure (other factories)
  // ============================================================
  for (const factory of [sdpf, saf, ndpf, rntic]) {
    // Create packing area
    await prisma.area.upsert({
      where: { factoryId_code: { factoryId: factory.id, code: 'PACKING' } },
      update: {},
      create: { factoryId: factory.id, code: 'PACKING', name: 'Packing Area', type: AreaType.PACKING },
    });
    await prisma.area.upsert({
      where: { factoryId_code: { factoryId: factory.id, code: 'UTILITY' } },
      update: {},
      create: { factoryId: factory.id, code: 'UTILITY', name: 'Utility Area', type: AreaType.UTILITY },
    });
  }

  // SDPF specific machines from Requirements Matrix
  const sdpfPackingArea = await prisma.area.findFirst({ where: { factoryId: sdpf.id, code: 'PACKING' } });
  if (sdpfPackingArea) {
    const sdpfMachines = [
      { code: 'SDPF-M1-BIGBETTI', name: 'Big Betti', type: MachineType.FILLING_MACHINE },
      { code: 'SDPF-M2-CARTOMAC', name: 'Cartomac', type: MachineType.CARTONING_MACHINE },
      { code: 'SDPF-M3-CHECKWEIGH', name: 'Checkweigher', type: MachineType.CHECKWEIGHER },
      { code: 'SDPF-M4-ROBOT', name: 'Palletizing Robot', type: MachineType.ROBOT },
      { code: 'SDPF-M5-PAKONA', name: 'PAKONA', type: MachineType.WRAPPING_MACHINE },
    ];
    for (const m of sdpfMachines) {
      await prisma.machine.upsert({
        where: { factoryId_code: { factoryId: sdpf.id, code: m.code } },
        update: {},
        create: { factoryId: sdpf.id, areaId: sdpfPackingArea.id, code: m.code, name: m.name, machineType: m.type, criticality: Criticality.HIGH },
      });
    }
  }

  // RNTIC blow molding machines
  const rnticPackingArea = await prisma.area.findFirst({ where: { factoryId: rntic.id, code: 'PACKING' } });
  if (rnticPackingArea) {
    const ebmMachines = ['EBM-17', 'EBM-14', 'EBM-13', 'EBM-12', 'EBM-11', 'EBM-7', 'SBM-20', 'SBM-10'];
    for (const m of ebmMachines) {
      await prisma.machine.upsert({
        where: { factoryId_code: { factoryId: rntic.id, code: `RNTIC-${m}` } },
        update: {},
        create: { factoryId: rntic.id, areaId: rnticPackingArea.id, code: `RNTIC-${m}`, name: m, machineType: MachineType.BLOW_MOLDING, criticality: Criticality.HIGH },
      });
    }
  }

  console.log(`✅ SDPF, SAF, NDPF, RNTIC basic structure seeded`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 NCC MES Platform seed completed successfully!');
  console.log('═'.repeat(60));
  console.log('\n📋 LOGIN CREDENTIALS (all use Password@123):');
  console.log('');
  console.log('  SUPER ADMIN (all factories):');
  console.log('    admin@industry360.sa      → SUPER_ADMIN');
  console.log('    soliman@industry360.sa    → SUPER_ADMIN');
  console.log('');
  console.log('  SIDCO (PoC Factory):');
  console.log('    issa.masadeh@sidco.com.sa    → FACTORY_ADMIN');
  console.log('    mohammed.brakat@sidco.com.sa  → PLANT_MANAGER');
  console.log('    mohammed.yousef@sidco.com.sa  → PRODUCTION_SUPERVISOR');
  console.log('    operator@sidco.com.sa          → OPERATOR');
  console.log('    maintenance@sidco.com.sa       → MAINTENANCE_TECHNICIAN');
  console.log('    quality@sidco.com.sa           → QUALITY_ENGINEER');
  console.log('');
  console.log('  Platform: http://localhost:3000');
  console.log('  API Docs: http://localhost:3001/api/docs');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
