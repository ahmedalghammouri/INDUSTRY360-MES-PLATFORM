// ============================================================
// STAR-MES — NCC / SIDCO MASTER-DATA RESET SEED
// ------------------------------------------------------------
// A clean "factory reset" seed that wipes the database and loads
// ONLY the master data needed at go-live, sourced 1:1 from
//   docs/NCC - Prerequisites File.xlsx
//
//   • Enterprise + Factory (site)
//   • Users & roles (IT & Reporting sheet)
//   • Areas / line / 5 packing machines (Machine & Line sheet)
//   • Shifts (Production & Shift sheet — 2×12h, Sat→Thu)
//   • Warehouses / storage locations (inventory)
//   • Raw materials & packaging
//   • Spare parts (from the machine parts list)
//   • Products / SKUs (31 powder-detergent SKUs)
//   • Per-SKU machine cycle times
//   • Downtime reasons (planned + per-machine unplanned)
//
// Run:  npx ts-node prisma/seed-ncc-master.ts
//       (or)  npm run prisma:seed:master   (see package.json)
// ============================================================

import {
  PrismaClient,
  UserRole,
  MachineType,
  Criticality,
  AreaType,
  LineType,
  DowntimeCategory,
  StorageZone,
  UomCategory,
  MachineState,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────
// 0. RESET — truncate every table (except the migration ledger)
// ────────────────────────────────────────────────────────────
async function resetDatabase() {
  const rows: Array<{ tablename: string }> = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`🧨 Reset: truncated ${rows.length} tables`);
}

// ────────────────────────────────────────────────────────────
// Helpers for parsing the SKU naming convention
// ────────────────────────────────────────────────────────────
/** "6X2 Kg" → { packPerCarton: 6, weight: 2 } */
function parsePack(name: string): { packPerCarton: number; weight: number } {
  const m = name.match(/(\d+)\s*[xX]\s*([\d.]+)\s*Kg/i);
  if (!m) return { packPerCarton: 1, weight: 1 };
  return { packPerCarton: parseInt(m[1], 10), weight: parseFloat(m[2]) };
}
/** brand = text before "Powder Detergent" */
function parseBrand(name: string): string {
  const b = name.split(/powder detergent/i)[0].trim();
  // normalise casing quirks from the source file
  return b
    .replace(/SIDCO EXtra White/i, 'SIDCO Extra White')
    .replace(/^REX$/i, 'Rex');
}
const foamType = (name: string): 'HF' | 'LF' => (/\bLF\b/i.test(name) ? 'LF' : 'HF');

async function main() {
  console.log('🌱 NCC / SIDCO master-data reset seed\n');
  await resetDatabase();

  const passwordHash = await bcrypt.hash('Password@123', 12);

  // ──────────────────────────────────────────────────────────
  // 1. ENTERPRISE + FACTORY (site)
  // ──────────────────────────────────────────────────────────
  const enterprise = await prisma.enterprise.create({
    data: {
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

  // Network factories shown on the manufacturing-network map. Every factory MUST
  // carry lat/lng — a NULL coordinate drops the pin AND hides it from the facilities
  // list. SIDCO is the PoC factory that carries all the master data below.
  await prisma.factory.createMany({
    data: [
      {
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
      {
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
      {
        enterpriseId: enterprise.id,
        code: 'NDPF',
        name: 'National Detergent Powder Factory',
        nameAr: 'المصنع الوطني للمنظفات',
        city: 'Dammam',
        country: 'SA',
        address: '2nd Industrial City, Dammam, Eastern Province',
        lat: 26.2541175,
        lng: 49.9869251,
        color: '#9B59B6',
        glowColor: 'rgba(155,89,182,0.3)',
        timezone: 'Asia/Riyadh',
      },
      {
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
    ],
  });

  // FACTORY (PoC) — SIDCO: carries every machine / SKU / shift / user below.
  const factory = await prisma.factory.create({
    data: {
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
  console.log(`✅ Enterprise + 5 factories (PoC: ${factory.name})`);

  // ──────────────────────────────────────────────────────────
  // 2. USERS & ROLES  (IT & Reporting sheet, #28)
  // ──────────────────────────────────────────────────────────
  // Platform super-admin (cross-factory login)
  await prisma.user.create({
    data: {
      enterpriseId: enterprise.id,
      factoryId: null,
      email: 'admin@star-mes.sa',
      name: 'System Administrator',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      department: 'IT',
      jobTitle: 'Platform Administrator',
    },
  });

  const users = await Promise.all(
    [
      {
        email: 'issa.masadeh@sidco.com.sa',
        name: 'Issa Masadeh',
        role: UserRole.FACTORY_ADMIN,
        jobTitle: 'Site SPOC / Admin',
        department: 'Operations',
        phone: '0539429752',
      },
      {
        email: 'mohammed.brakat@sidco.com.sa',
        name: 'Mohammed Brakat',
        role: UserRole.PRODUCTION_MANAGER,
        jobTitle: 'Production Manager',
        department: 'Production',
      },
      {
        email: 'mohammed.yousef@sidco.com.sa',
        name: 'Mohammed Yousef',
        role: UserRole.PRODUCTION_SUPERVISOR,
        jobTitle: 'Production Supervisor',
        department: 'Production',
      },
    ].map((u) =>
      prisma.user.create({
        data: {
          enterpriseId: enterprise.id,
          factoryId: factory.id,
          passwordHash,
          notifyEmail: true,
          ...u,
        },
      }),
    ),
  );
  console.log(`✅ Users: ${users.length + 1} (incl. platform admin)`);

  // ──────────────────────────────────────────────────────────
  // 3. STORAGE LOCATIONS / WAREHOUSES (inventory)
  // ──────────────────────────────────────────────────────────
  const storageDefs: Array<{ code: string; name: string; zone: StorageZone }> = [
    { code: 'RM-WH-01', name: 'Raw Material Warehouse', zone: StorageZone.RAW_MATERIAL },
    { code: 'FG-WH-01', name: 'Finished Goods Warehouse', zone: StorageZone.FINISHED_GOODS },
    { code: 'SP-ST-01', name: 'Spare Parts Store', zone: StorageZone.SPARE_PARTS },
    { code: 'QC-HOLD-01', name: 'Quarantine / QC Hold', zone: StorageZone.QUARANTINE },
    { code: 'PROD-STG-01', name: 'Packing Line Staging', zone: StorageZone.PRODUCTION },
    { code: 'DISP-01', name: 'Dispatch Bay', zone: StorageZone.DISPATCH },
  ];
  const storage: Record<string, string> = {};
  for (const s of storageDefs) {
    const row = await prisma.storageLocation.create({
      data: { factoryId: factory.id, code: s.code, name: s.name, zone: s.zone },
    });
    storage[s.zone] = row.id;
  }
  console.log(`✅ Storage locations: ${storageDefs.length}`);

  // ──────────────────────────────────────────────────────────
  // 4. AREAS + LINE + MACHINES  (Machine & Line sheet, #15–#18)
  // ──────────────────────────────────────────────────────────
  const packingArea = await prisma.area.create({
    data: { factoryId: factory.id, code: 'PCK', name: 'Packing', nameAr: 'التعبئة', type: AreaType.PACKING },
  });
  await prisma.area.create({
    data: { factoryId: factory.id, code: 'WH', name: 'Warehouse', nameAr: 'المستودعات', type: AreaType.WAREHOUSE },
  });

  const packingLine = await prisma.productionLine.create({
    data: {
      factoryId: factory.id,
      areaId: packingArea.id,
      code: 'PL-01',
      name: 'Powder Packing Line 1',
      nameAr: 'خط تعبئة المسحوق 1',
      type: LineType.PACKING,
    },
  });

  // Downtime threshold = 1 minute (sheet #18); max rated speed = 45 duplex/min (sheet #17)
  const machineDefs: Array<{
    code: string;
    name: string;
    type: MachineType;
    designCapacity: number; // units/hour (rough, per machine unit)
    crit: Criticality;
  }> = [
    { code: 'M1', name: 'Big Betti', type: MachineType.FILLING_MACHINE, designCapacity: 2700, crit: Criticality.CRITICAL },
    { code: 'M2', name: 'Checkweigher', type: MachineType.CHECKWEIGHER, designCapacity: 2700, crit: Criticality.HIGH },
    { code: 'M3', name: 'Cartomac', type: MachineType.CARTONING_MACHINE, designCapacity: 130, crit: Criticality.CRITICAL },
    { code: 'M4', name: 'Euro-Pack Robot', type: MachineType.PALLETIZER, designCapacity: 12, crit: Criticality.HIGH },
    { code: 'M5', name: 'Uni-tech Wrapping', type: MachineType.WRAPPING_MACHINE, designCapacity: 24, crit: Criticality.MEDIUM },
  ];
  const machines: Record<string, string> = {};
  for (let i = 0; i < machineDefs.length; i++) {
    const m = machineDefs[i];
    const row = await prisma.machine.create({
      data: {
        factoryId: factory.id,
        areaId: packingArea.id,
        lineId: packingLine.id,
        code: m.code,
        name: m.name,
        sortOrder: i,
        machineType: m.type,
        criticality: m.crit,
        designCapacity: m.designCapacity,
        downtimeThreshold: 60, // 1 minute
        currentStatus: { create: { state: MachineState.OFFLINE } },
      },
    });
    machines[m.code] = row.id;
  }
  console.log(`✅ Machines: ${machineDefs.length} (M1–M5 on ${packingLine.name})`);

  // ──────────────────────────────────────────────────────────
  // 5. SHIFTS  (Production & Shift sheet, #3–#11)
  // 2 shifts/day · 12h each · 11 planned prod. hours · 0.5h break
  // + 0.5h cleaning · target 3500/shift · Sat→Thu (6 days/week)
  // ──────────────────────────────────────────────────────────
  const satToThu = [6, 0, 1, 2, 3, 4]; // 0=Sun … 6=Sat (Friday=5 excluded)
  await prisma.shiftTemplate.createMany({
    data: [
      {
        factoryId: factory.id,
        code: 'S1',
        name: 'Shift 1 — Day',
        nameAr: 'الوردية الأولى — نهارية',
        startTime: '07:30',
        endTime: '19:30',
        crossesMidnight: false,
        plannedProductionHours: 11,
        shiftDurationHours: 12,
        breakMinutes: 30,
        cleaningMinutes: 30,
        days: satToThu,
        targetQtyPerShift: 3500,
      },
      {
        factoryId: factory.id,
        code: 'S2',
        name: 'Shift 2 — Night',
        nameAr: 'الوردية الثانية — ليلية',
        startTime: '19:30',
        endTime: '07:30',
        crossesMidnight: true,
        plannedProductionHours: 11,
        shiftDurationHours: 12,
        breakMinutes: 30,
        cleaningMinutes: 30,
        days: satToThu,
        targetQtyPerShift: 3500,
      },
    ],
  });
  console.log('✅ Shifts: 2 × 12h (Day 07:30–19:30, Night 19:30–07:30)');

  // ──────────────────────────────────────────────────────────
  // 6. UNITS OF MEASURE (canonical — needed by raw materials)
  // ──────────────────────────────────────────────────────────
  const uomDefs: Array<{ code: string; name: string; category: UomCategory; base?: string; factor?: number }> = [
    { code: 'KG', name: 'Kilogram', category: UomCategory.WEIGHT, base: 'KG', factor: 1 },
    { code: 'G', name: 'Gram', category: UomCategory.WEIGHT, base: 'KG', factor: 0.001 },
    { code: 'TON', name: 'Metric Ton', category: UomCategory.WEIGHT, base: 'KG', factor: 1000 },
    { code: 'L', name: 'Litre', category: UomCategory.VOLUME, base: 'L', factor: 1 },
    { code: 'ML', name: 'Millilitre', category: UomCategory.VOLUME, base: 'L', factor: 0.001 },
    { code: 'PCS', name: 'Pieces', category: UomCategory.COUNT, base: 'PCS', factor: 1 },
    { code: 'ROLL', name: 'Roll', category: UomCategory.COUNT, base: 'PCS', factor: 1 },
    { code: 'INNER', name: 'Inner', category: UomCategory.PACKAGING, base: 'PCS', factor: 1 },
    { code: 'CARTON', name: 'Carton', category: UomCategory.PACKAGING, base: 'PCS', factor: 1 },
    { code: 'PALLET', name: 'Pallet', category: UomCategory.PACKAGING, base: 'PCS', factor: 1 },
    { code: 'M', name: 'Metre', category: UomCategory.LENGTH, base: 'M', factor: 1 },
  ];
  const uom: Record<string, string> = {};
  for (let i = 0; i < uomDefs.length; i++) {
    const u = uomDefs[i];
    const row = await prisma.unitOfMeasure.create({
      data: {
        factoryId: factory.id,
        code: u.code,
        name: u.name,
        category: u.category,
        baseUnitCode: u.base,
        conversionFactor: u.factor ?? 1,
        sortOrder: i,
      },
    });
    uom[u.code] = row.id;
  }
  console.log(`✅ Units of measure: ${uomDefs.length}`);

  // ──────────────────────────────────────────────────────────
  // 7. RAW MATERIALS & PACKAGING (inventory)
  // ──────────────────────────────────────────────────────────
  const rmDefs: Array<{
    code: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    min: number;
    max: number;
  }> = [
    { code: 'RM-PWD-HF', name: 'Detergent Powder — High Foam (bulk)', category: 'RAW', unit: 'KG', stock: 48000, min: 8000, max: 120000 },
    { code: 'RM-PWD-LF', name: 'Detergent Powder — Low Foam (bulk)', category: 'RAW', unit: 'KG', stock: 32000, min: 6000, max: 90000 },
    { code: 'PK-BAG-125', name: 'Inner Film/Bag — 1.25 Kg', category: 'PACKAGING', unit: 'PCS', stock: 60000, min: 10000, max: 200000 },
    { code: 'PK-BAG-150', name: 'Inner Film/Bag — 1.5 Kg', category: 'PACKAGING', unit: 'PCS', stock: 80000, min: 12000, max: 200000 },
    { code: 'PK-BAG-200', name: 'Inner Film/Bag — 2 Kg', category: 'PACKAGING', unit: 'PCS', stock: 55000, min: 10000, max: 200000 },
    { code: 'PK-BAG-225', name: 'Inner Film/Bag — 2.25 Kg', category: 'PACKAGING', unit: 'PCS', stock: 70000, min: 12000, max: 200000 },
    { code: 'PK-BAG-250', name: 'Inner Film/Bag — 2.5 Kg', category: 'PACKAGING', unit: 'PCS', stock: 40000, min: 8000, max: 150000 },
    { code: 'PK-CTN-4', name: 'Carton Box — 4-pack', category: 'PACKAGING', unit: 'PCS', stock: 18000, min: 3000, max: 60000 },
    { code: 'PK-CTN-6', name: 'Carton Box — 6-pack', category: 'PACKAGING', unit: 'PCS', stock: 22000, min: 4000, max: 60000 },
    { code: 'PK-GLUE', name: 'Hot-Melt Glue', category: 'CONSUMABLE', unit: 'KG', stock: 450, min: 80, max: 1200 },
    { code: 'PK-STRETCH', name: 'Stretch Wrap Film', category: 'CONSUMABLE', unit: 'ROLL', stock: 220, min: 40, max: 600 },
    { code: 'PK-SHRINK', name: 'Shrink Film', category: 'CONSUMABLE', unit: 'ROLL', stock: 180, min: 30, max: 500 },
    { code: 'PK-INK', name: 'Printer Ink / Coding Ribbon', category: 'CONSUMABLE', unit: 'PCS', stock: 120, min: 25, max: 400 },
    { code: 'PK-TAPE', name: 'Carton Sealing Tape', category: 'CONSUMABLE', unit: 'ROLL', stock: 300, min: 60, max: 800 },
    { code: 'PK-PALLET', name: 'Wooden Pallet', category: 'CONSUMABLE', unit: 'PCS', stock: 900, min: 150, max: 2500 },
  ];
  await prisma.rawMaterial.createMany({
    data: rmDefs.map((r) => ({
      factoryId: factory.id,
      code: r.code,
      name: r.name,
      category: r.category,
      unit: r.unit,
      unitId: uom[r.unit],
      currentStock: r.stock,
      minStock: r.min,
      maxStock: r.max,
      reorderPoint: Math.round(r.min * 1.3),
      storageLocationId: storage[StorageZone.RAW_MATERIAL],
    })),
  });
  console.log(`✅ Raw materials & packaging: ${rmDefs.length}`);

  // ──────────────────────────────────────────────────────────
  // 8. SPARE PARTS (from the machine parts list, sheet 2)
  // ──────────────────────────────────────────────────────────
  const spDefs: Array<{ part: string; name: string; cat: string; stock: number; min: number }> = [
    // Big Betti
    { part: 'BB-PST-01', name: 'Powder inlet gate piston', cat: 'Pneumatic', stock: 4, min: 2 },
    { part: 'BB-PST-02', name: 'Screw piston — powder inlet gate to inner', cat: 'Pneumatic', stock: 3, min: 2 },
    { part: 'BB-GLU-01', name: 'Glue tank piston + internal board', cat: 'Mechanical', stock: 2, min: 1 },
    { part: 'BB-GLU-02', name: 'Glue system nozzle (complete)', cat: 'Mechanical', stock: 5, min: 2 },
    { part: 'BB-INV-01', name: 'Inverter / VFD', cat: 'Electrical', stock: 2, min: 1 },
    { part: 'BB-HLD-01', name: 'Inner holder', cat: 'Mechanical', stock: 4, min: 2 },
    { part: 'BB-CUP-01', name: 'Inner section cup', cat: 'Mechanical', stock: 6, min: 2 },
    { part: 'BB-ROL-01', name: 'Inner drive rollers', cat: 'Mechanical', stock: 8, min: 3 },
    { part: 'BB-SNS-01', name: 'Door safety sensor', cat: 'Electrical', stock: 6, min: 2 },
    { part: 'BB-CHN-01', name: 'Drive chain', cat: 'Mechanical', stock: 4, min: 2 },
    // Cartomac
    { part: 'CM-PST-01', name: 'Lower large piston', cat: 'Pneumatic', stock: 3, min: 1 },
    { part: 'CM-CUP-01', name: 'Carton section cup', cat: 'Mechanical', stock: 5, min: 2 },
    { part: 'CM-PST-02', name: 'Carton closing piston (right & left)', cat: 'Pneumatic', stock: 4, min: 2 },
    { part: 'CM-PST-03', name: 'Fixing piston + fixing track', cat: 'Mechanical', stock: 3, min: 1 },
    { part: 'CM-GLU-01', name: 'Glue tank piston + internal board', cat: 'Mechanical', stock: 2, min: 1 },
    { part: 'CM-GLU-02', name: 'Glue system nozzle (complete)', cat: 'Mechanical', stock: 5, min: 2 },
    { part: 'CM-SNS-01', name: 'Door safety sensor', cat: 'Electrical', stock: 6, min: 2 },
    { part: 'CM-CHN-01', name: 'Drive chain', cat: 'Mechanical', stock: 4, min: 2 },
    // Euro-Pack Robot
    { part: 'EP-PST-01', name: 'Stretch-roll cutting piston + arm', cat: 'Pneumatic', stock: 2, min: 1 },
    { part: 'EP-CHN-01', name: 'Drive chain', cat: 'Mechanical', stock: 3, min: 1 },
    { part: 'EP-SNS-01', name: 'Door safety sensor', cat: 'Electrical', stock: 4, min: 2 },
    // Shared utility
    { part: 'COM-AC-01', name: 'Panel A/C cooling unit', cat: 'Utility', stock: 2, min: 1 },
  ];
  await prisma.sparePart.createMany({
    data: spDefs.map((s) => ({
      factoryId: factory.id,
      partNumber: s.part,
      name: s.name,
      category: s.cat,
      stockQty: s.stock,
      minStockQty: s.min,
      maxStockQty: s.min * 5,
      storageLocationId: storage[StorageZone.SPARE_PARTS],
    })),
  });
  console.log(`✅ Spare parts: ${spDefs.length}`);

  // ──────────────────────────────────────────────────────────
  // 9. PRODUCT LOOKUPS  (category / brand / packaging / unit / weight)
  // ──────────────────────────────────────────────────────────
  const skuRaw: Array<[string, string]> = [
    ['10310064', 'Alwatani Powder Detergent - Violet HF - 6X2 Kg C'],
    ['10310067', 'Alwatani Powder Detergent - Blue HF - 6X2 Kg C'],
    ['10310110', 'SIDCO Extra White Powder Detergent - Original HF - 6X1.5 Kg C'],
    ['10310111', 'SIDCO Extra White Powder Detergent - Flower HF - 6X1.5 Kg C'],
    ['10310112', 'SIDCO Extra White Powder Detergent - Jasmine HF - 6X1.5 Kg C'],
    ['10310113', 'SIDCO Extra White Powder Detergent - Original LF - 6X1.5 Kg C'],
    ['10310189', 'GENTO Powder Detergent - Flower HF - 4X2.25 Kg C'],
    ['10310190', 'GENTO Powder Detergent - Oud HF - 4X2.25 Kg C'],
    ['10310191', 'GENTO Powder Detergent - Original HF - 4X2.25 Kg C'],
    ['10310192', 'GENTO Powder Detergent - Green - Flower LF - 4X2.25 Kg C'],
    ['10310193', 'GENTO Powder Detergent - Green - Oud LF - 4X2.25 Kg C'],
    ['10310194', 'GENTO Powder Detergent - Green - Original LF - 4X2.25 Kg C'],
    ['10310201', 'GENTO Powder Detergent - Original HF - 6X1.25 Kg C'],
    ['10310202', 'GENTO Powder Detergent - Flower HF - 6X1.25 Kg C'],
    ['10310203', 'GENTO Powder Detergent - Oud HF - 6X1.25 Kg C'],
    ['10310204', 'GENTO Powder Detergent - Original LF - 6X1.25 Kg C'],
    ['10310205', 'GENTO Powder Detergent - Flower LF - 6X1.25 Kg C'],
    ['10310206', 'GENTO Powder Detergent - Oud LF - 6X1.25 Kg C'],
    ['10310213', 'Safe Powder Detergent - Flower HF - 4X2.25 Kg C'],
    ['10310214', 'Safe Powder Detergent - Original HF - 4X2.25 Kg C'],
    ['10310215', 'Safe Powder Detergent - Flower LF - 4X2.25 Kg C'],
    ['10310216', 'Safe Powder Detergent - Original LF - 4X2.25 Kg C'],
    ['10310217', 'GENTO Powder Detergent - Musk HF - 4X2.25 Kg C'],
    ['10310218', 'GENTO Powder Detergent - Elegant HF - 4X2.25 Kg C'],
    ['10310219', 'GENTO Powder Detergent - Green - Musk LF - 4X2.25 Kg C'],
    ['10310220', 'GENTO Powder Detergent - Green - Elegant LF - 4X2.25 Kg C'],
    ['10310235', 'GENTO Powder Detergent - Gold HF - 4X2.25 Kg C'],
    ['10310236', 'GENTO Powder Detergent - Gold LF - 4X2.25 Kg C'],
    ['10310290', 'Miza (Panda) Powder Detergent - HF - 4x2.25 Kg C'],
    ['10310291', 'Miza (Panda) Powder Detergent - LF - 4x2.25 Kg C'],
    ['10310297', 'Rex Powder Detergent - HF - 6x2.5 Kg C'],
    ['10310298', 'Rex Powder Detergent - LF - 6x2.5 Kg C'],
  ];

  const category = await prisma.productCategory.create({
    data: { factoryId: factory.id, name: 'Powder Detergent', nameAr: 'مسحوق غسيل' },
  });

  // Brands
  const brandNames = [...new Set(skuRaw.map(([, n]) => parseBrand(n)))];
  const brandId: Record<string, string> = {};
  for (let i = 0; i < brandNames.length; i++) {
    const row = await prisma.productBrand.create({
      data: { factoryId: factory.id, name: brandNames[i], sortOrder: i },
    });
    brandId[brandNames[i]] = row.id;
  }

  // Base units (sales/packaging units)
  const baseUnitId: Record<string, string> = {};
  for (const [i, code] of ['CARTON', 'INNER', 'PALLET', 'PCS'].entries()) {
    const row = await prisma.baseUnit.create({
      data: { factoryId: factory.id, code, name: code.charAt(0) + code.slice(1).toLowerCase(), sortOrder: i },
    });
    baseUnitId[code] = row.id;
  }

  // Base weights
  const weights = [...new Set(skuRaw.map(([, n]) => parsePack(n).weight))].sort((a, b) => a - b);
  const baseWeightId: Record<number, string> = {};
  for (let i = 0; i < weights.length; i++) {
    const row = await prisma.baseWeight.create({
      data: { factoryId: factory.id, value: weights[i], unit: 'kg', label: `${weights[i]} Kg`, sortOrder: i },
    });
    baseWeightId[weights[i]] = row.id;
  }

  // Packaging types (one per pack configuration)
  const packLabels = [...new Set(skuRaw.map(([, n]) => {
    const { packPerCarton, weight } = parsePack(n);
    return `${packPerCarton}×${weight} Kg Carton`;
  }))];
  const packId: Record<string, string> = {};
  for (let i = 0; i < packLabels.length; i++) {
    const row = await prisma.packagingType.create({
      data: { factoryId: factory.id, name: packLabels[i], sortOrder: i },
    });
    packId[packLabels[i]] = row.id;
  }
  console.log(`✅ Lookups: 1 category · ${brandNames.length} brands · ${weights.length} weights · ${packLabels.length} packaging types`);

  // ──────────────────────────────────────────────────────────
  // 10. SKUs (31 finished products)
  // ──────────────────────────────────────────────────────────
  const skuId: Record<string, { id: string; weight: number }> = {};
  for (const [itemNumber, name] of skuRaw) {
    const { packPerCarton, weight } = parsePack(name);
    const brand = parseBrand(name);
    const packLabel = `${packPerCarton}×${weight} Kg Carton`;
    const row = await prisma.sKU.create({
      data: {
        factoryId: factory.id,
        itemNumber,
        code: itemNumber,
        name,
        shortName: `${brand} ${weight}Kg ${foamType(name)}`,
        brand,
        category: category.name,
        categoryId: category.id,
        brandId: brandId[brand],
        packagingTypeId: packId[packLabel],
        baseUnitId: baseUnitId['CARTON'],
        baseWeightId: baseWeightId[weight],
        weight,
        weightUnit: 'kg',
        packagingType: packLabel,
        unitsPerInner: 1,
        innersPerCarton: packPerCarton,
        cartonsPerPallet: 50,
        baseUnit: 'CARTON',
        storageLocationId: storage[StorageZone.FINISHED_GOODS],
        metadata: { foam: foamType(name) },
      },
    });
    skuId[itemNumber] = { id: row.id, weight };
  }
  console.log(`✅ SKUs: ${skuRaw.length} powder-detergent products`);

  // ──────────────────────────────────────────────────────────
  // 11. MACHINE CYCLE TIMES  (per SKU per machine, Machine & Line sheet)
  // Cycle seconds keyed by base weight (1.5 / 2 / 2.25 from the file;
  // 1.25 → nearest 1.5, 2.5 → nearest 2.25).
  // ──────────────────────────────────────────────────────────
  const nearestW = (w: number): 1.5 | 2 | 2.25 => (w <= 1.5 ? 1.5 : w >= 2.5 ? 2.25 : (w as 2 | 2.25));
  const cycleByMachine: Record<string, { unit: string; sec: Record<number, number> }> = {
    M1: { unit: 'INNER', sec: { 1.5: 30, 2: 31, 2.25: 35 } }, // Big Betti
    M2: { unit: 'INNER', sec: { 1.5: 30, 2: 31, 2.25: 35 } }, // Checkweigher (inline, ≈ filling)
    M3: { unit: 'CARTON', sec: { 1.5: 30, 2: 25, 2.25: 40 } }, // Cartomac
    M4: { unit: 'PALLET', sec: { 1.5: 470, 2: 290, 2.25: 275 } }, // Euro-Pack Robot
    M5: { unit: 'PALLET', sec: { 1.5: 170, 2: 145, 2.25: 150 } }, // Uni-tech Wrapping
  };
  let cycleCount = 0;
  for (const { id, weight } of Object.values(skuId)) {
    for (const [mCode, cfg] of Object.entries(cycleByMachine)) {
      const sec = cfg.sec[nearestW(weight)];
      await prisma.machineCycleTime.create({
        data: {
          machineId: machines[mCode],
          skuId: id,
          cycleTimeSeconds: sec,
          unitType: cfg.unit,
          maxSpeed: Math.round(3600 / sec),
          source: 'NCC_DATA',
        },
      });
      cycleCount++;
    }
  }
  console.log(`✅ Machine cycle times: ${cycleCount}`);

  // ──────────────────────────────────────────────────────────
  // 12. DOWNTIME REASONS  (planned + per-machine unplanned, sheet 2)
  // ──────────────────────────────────────────────────────────
  // Planned (factory-wide)
  await prisma.downtimeCause.createMany({
    data: [
      { factoryId: factory.id, code: 'PD-CLEAN', name: 'Cleaning', category: DowntimeCategory.PLANNED_CLEANING, isPlanned: true, sortOrder: 1 },
      { factoryId: factory.id, code: 'PD-BREAK', name: 'Break / Meal', category: DowntimeCategory.PLANNED_BREAK, isPlanned: true, sortOrder: 2 },
      { factoryId: factory.id, code: 'PD-CO', name: 'Changeover (format / product)', category: DowntimeCategory.CHANGEOVER, isPlanned: true, sortOrder: 3 },
      { factoryId: factory.id, code: 'PD-PM', name: 'Planned Maintenance', category: DowntimeCategory.PLANNED_MAINTENANCE, isPlanned: true, sortOrder: 4 },
    ],
  });

  // Map a free-text reason to an ISA-95 downtime category
  const cat = (r: string): DowntimeCategory => {
    const s = r.toLowerCase();
    if (/(air|a\/c)/.test(s)) return DowntimeCategory.UTILITY;
    if (/(power|inverter|electric|trip|sensor)/.test(s)) return DowntimeCategory.ELECTRICAL;
    if (/(powder|packing mat|material)/.test(s)) return DowntimeCategory.MATERIAL;
    if (/printer/.test(s)) return DowntimeCategory.OTHER;
    return DowntimeCategory.MECHANICAL; // pistons, cups, chains, rollers, glue, holders…
  };

  const unplanned: Record<string, string[]> = {
    M1: [
      'Piston for powder inlet gate',
      'Screw piston for opening the powder inlet gate to the inner',
      'Glue tank piston + internal board',
      'Glue system complete nozzle',
      'Inverter',
      'Inner holder',
      'Air',
      'Inner section cup',
      'A/C',
      'Electrical problems',
      'Electrical trip for the checkweigher belt',
      'Rollers drive the inner',
      'Door sensors',
      'Main power failure',
      'Chain',
      'Powder',
      'Printer machine',
      'Packing material',
    ],
    M3: [
      'Cartomac machine — lower large piston',
      'Carton section cup',
      'Carton closing piston right & left',
      'Fixing piston and fixing track',
      'Glue tank piston + internal board',
      'Glue system complete nozzle',
      'A/C',
      'Door sensors',
      'Chain',
      'Packing material',
      'Main power failure',
      'Air',
      'Electrical problems',
      'Printer machine',
    ],
    M4: [
      'Piston and arm for cutting the stretch roll',
      'Electrical trip for pallet wrapping rotating',
      'A/C',
      'Chain',
      'Door sensors',
      'Air',
      'Electrical problems',
      'Main power failure',
    ],
  };
  let dtCount = 0;
  for (const [mCode, reasons] of Object.entries(unplanned)) {
    for (let i = 0; i < reasons.length; i++) {
      await prisma.downtimeCause.create({
        data: {
          factoryId: factory.id,
          machineId: machines[mCode],
          code: `DT-${mCode}-${String(i + 1).padStart(2, '0')}`,
          name: reasons[i],
          category: cat(reasons[i]),
          isPlanned: false,
          sortOrder: i + 1,
        },
      });
      dtCount++;
    }
  }
  console.log(`✅ Downtime reasons: 4 planned + ${dtCount} unplanned (per machine)`);

  console.log('\n🎉 Master-data reset complete.\n   Login: admin@star-mes.sa / Password@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
