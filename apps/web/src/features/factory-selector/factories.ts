export interface Factory {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  district: string;
  districtAr: string;
  /** Real-world WGS84 coordinates */
  lat: number;
  lng: number;
  color: string;
  glowColor: string;
  isActive?: boolean;
  kpis: FactoryKPI;
}

export interface FactoryKPI {
  oee: number;
  production: number;
  productionUnit: string;
  quality: number;
  availability: number;
  performance: number;
  activeAlarms: number;
  employees: number;
  shiftsToday: number;
  uptime: number;
}

export const FACTORIES: Factory[] = [
  {
    id: 'SDPF',
    code: 'SDPF',
    name: 'Saudi Detergent Powder Factory',
    nameAr: 'مصنع مسحوق المنظفات السعودي',
    city: 'Dammam',
    cityAr: 'الدمام',
    district: 'Third Industrial City',
    districtAr: 'المدينة الصناعية الثالثة',
    lat: 26.25839228,
    lng: 49.99227038,
    color: '#00d4ff',
    glowColor: 'rgba(0,212,255,0.35)',
    kpis: { oee: 84.2, production: 1240, productionUnit: 'tons/day', quality: 97.8, availability: 91.5, performance: 88.3, activeAlarms: 3, employees: 187, shiftsToday: 3, uptime: 99.1 },
  },
  {
    id: 'SAF',
    code: 'SAF',
    name: 'Saudi Aerosol Factory',
    nameAr: 'مصنع الإيروسول السعودي',
    city: 'Dammam',
    cityAr: 'الدمام',
    district: 'Second Industrial City',
    districtAr: 'المدينة الصناعية الثانية',
    lat: 26.25466432,
    lng: 49.93058171,
    color: '#a855f7',
    glowColor: 'rgba(168,85,247,0.35)',
    kpis: { oee: 79.6, production: 68000, productionUnit: 'units/day', quality: 99.2, availability: 88.4, performance: 82.1, activeAlarms: 1, employees: 124, shiftsToday: 2, uptime: 97.4 },
  },
  {
    id: 'NDPF',
    code: 'NDPF',
    name: 'National Detergent Powder Factory',
    nameAr: 'مصنع مسحوق المنظفات الوطني',
    city: 'Dammam',
    cityAr: 'الدمام',
    district: 'Second Industrial City',
    districtAr: 'المدينة الصناعية الثانية',
    lat: 26.25411750,
    lng: 49.98692510,
    color: '#22c55e',
    glowColor: 'rgba(34,197,94,0.35)',
    kpis: { oee: 88.7, production: 980, productionUnit: 'tons/day', quality: 98.5, availability: 93.2, performance: 91.8, activeAlarms: 0, employees: 156, shiftsToday: 3, uptime: 99.8 },
  },
  {
    id: 'SIDCO',
    code: 'SIDCO',
    name: 'Saudi Industrial Detergent Company',
    nameAr: 'الشركة السعودية للمنظفات الصناعية',
    city: 'Dammam',
    cityAr: 'الدمام',
    district: 'Second Industrial City',
    districtAr: 'المدينة الصناعية الثانية',
    lat: 26.27130673,
    lng: 49.96291053,
    color: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.35)',
    kpis: { oee: 76.3, production: 2100, productionUnit: 'tons/day', quality: 96.4, availability: 85.7, performance: 79.9, activeAlarms: 5, employees: 203, shiftsToday: 3, uptime: 96.2 },
  },
  {
    id: 'RNTIC',
    code: 'RNTIC',
    name: 'Plastic Blow Molding Manufacturing',
    nameAr: 'مصنع تشكيل البلاستيك بالنفخ',
    city: 'Jeddah',
    cityAr: 'جدة',
    district: 'First Industrial City',
    districtAr: 'المدينة الصناعية الأولى',
    lat: 21.43113428,
    lng: 39.20376108,
    color: '#ef4444',
    glowColor: 'rgba(239,68,68,0.35)',
    kpis: { oee: 81.9, production: 45000, productionUnit: 'units/day', quality: 97.1, availability: 89.6, performance: 85.4, activeAlarms: 2, employees: 142, shiftsToday: 2, uptime: 98.3 },
  },
];
