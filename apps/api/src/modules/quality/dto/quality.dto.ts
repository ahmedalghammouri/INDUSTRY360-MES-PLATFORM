import {
  IsString, IsInt, IsUUID, IsOptional, IsEnum, IsDateString,
  Min, Max, MaxLength, MinLength, IsPositive, IsArray, ValidateNested,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── INSPECTION ──────────────────────────────────────────────

export enum InspectionType {
  INCOMING = 'INCOMING',
  IN_PROCESS = 'IN_PROCESS',
  FINAL = 'FINAL',
  SPC = 'SPC',
  PATROL = 'PATROL',
  AUDIT = 'AUDIT',
}

export enum InspectionResult {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
  CONDITIONAL = 'CONDITIONAL',
}

export class MeasurementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parameterId?: string;

  @ApiProperty()
  @IsString()
  parameterName!: string;

  @ApiProperty()
  @IsNumber()
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  pass?: boolean;
}

export class CreateInspectionDto {
  @ApiPropertyOptional({ example: 'uuid-plan-id' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({ example: 'uuid-work-order-id' })
  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @ApiPropertyOptional({ example: 'uuid-batch-id' })
  @IsOptional()
  @IsUUID()
  batchRecordId?: string;

  @ApiPropertyOptional({ example: 'uuid-machine-id' })
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiProperty({ enum: InspectionType })
  @IsEnum(InspectionType)
  type!: InspectionType;

  @ApiProperty({ example: 100, description: 'Total sample quantity inspected' })
  @IsInt()
  @IsPositive()
  totalQty!: number;

  @ApiProperty({ example: 98 })
  @IsInt()
  @Min(0)
  passQty!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  failQty!: number;

  @ApiPropertyOptional({ type: [MeasurementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasurementDto)
  measurements?: MeasurementDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  inspectedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateInspectionDto {
  @ApiPropertyOptional({ enum: InspectionResult })
  @IsOptional()
  @IsEnum(InspectionResult)
  result?: InspectionResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  failQty?: number;

  @ApiPropertyOptional({ type: [MeasurementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasurementDto)
  measurements?: MeasurementDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ─── NCR ─────────────────────────────────────────────────────

export enum NCRSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export enum NCRStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  CAPA_PENDING = 'CAPA_PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

const NCR_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED'],
  IN_REVIEW: ['CAPA_PENDING', 'RESOLVED'],
  CAPA_PENDING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export { NCR_TRANSITIONS };

export class CreateNCRDto {
  @ApiProperty({ example: 'Label misalignment on Betti 2L batch' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Detected 15 units with misaligned labels in batch B240606-001' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: NCRSeverity })
  @IsEnum(NCRSeverity)
  severity!: NCRSeverity;

  @ApiPropertyOptional({ example: 'uuid-sku-id' })
  @IsOptional()
  @IsUUID()
  skuId?: string;

  @ApiPropertyOptional({ example: 'uuid-batch-id' })
  @IsOptional()
  @IsUUID()
  batchRecordId?: string;

  @ApiPropertyOptional({ example: 'uuid-machine-id' })
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiProperty({ example: 'LABELING', description: 'Defect category code' })
  @IsString()
  @MaxLength(100)
  defectCategory!: string;

  @ApiPropertyOptional({ example: 'DC-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defectCode?: string;

  @ApiProperty({ example: 15, description: 'Non-conforming quantity' })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ example: 'REWORK', enum: ['USE_AS_IS', 'REWORK', 'SCRAP', 'RETURN_TO_SUPPLIER'] })
  @IsOptional()
  @IsString()
  disposition?: string;

  @ApiProperty({ example: '2026-06-06T08:30:00.000Z' })
  @IsDateString()
  detectedAt!: string;

  @ApiProperty({ example: '2026-06-08T17:00:00.000Z', description: 'Resolution due date' })
  @IsDateString()
  dueDate!: string;
}

export class UpdateNCRDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: NCRSeverity })
  @IsOptional()
  @IsEnum(NCRSeverity)
  severity?: NCRSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disposition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  correctiveAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preventiveAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateNCRStatusDto {
  @ApiProperty({ enum: NCRStatus })
  @IsEnum(NCRStatus)
  status!: NCRStatus;

  @ApiPropertyOptional({ example: 'Root cause identified as labeler tension setting' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

// ─── CAPA ────────────────────────────────────────────────────

export enum CAPAType {
  CORRECTIVE = 'CORRECTIVE',
  PREVENTIVE = 'PREVENTIVE',
}

export enum CAPAStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

export enum CAPAPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateCAPADto {
  @ApiPropertyOptional({ example: 'uuid-ncr-id' })
  @IsOptional()
  @IsUUID()
  ncrId?: string;

  @ApiProperty({ enum: CAPAType })
  @IsEnum(CAPAType)
  type!: CAPAType;

  @ApiProperty({ example: 'Adjust labeler tension to factory spec and recalibrate' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'The labeler tension was set at 85N vs the 100N factory specification...' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: CAPAPriority })
  @IsEnum(CAPAPriority)
  priority!: CAPAPriority;

  @ApiPropertyOptional({ example: 'uuid-assigned-user-id' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ example: '2026-06-10T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateCAPADto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: CAPAPriority })
  @IsOptional()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  effectiveness?: string;
}

export class AddCAPAActionDto {
  @ApiProperty({ example: 'Recalibrate labeler tension to 100N per factory spec' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ example: 'uuid-user-id' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class VerifyCAPADto {
  @ApiProperty({ example: 'Action verified effective — no recurrence in 30 days' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  effectiveness!: string;
}
