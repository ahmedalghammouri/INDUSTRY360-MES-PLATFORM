import {
  IsString, IsInt, IsPositive, IsDateString, IsEnum, IsOptional,
  IsUUID, MinLength, MaxLength, Min, Max, IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum WOPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateWorkOrderDto {
  @ApiProperty({ example: 'uuid-sku-id' })
  @IsUUID()
  skuId!: string;

  @ApiProperty({ example: 'uuid-machine-id' })
  @IsUUID()
  machineId!: string;

  @ApiPropertyOptional({ example: 'uuid-line-id' })
  @IsOptional()
  @IsUUID()
  lineId?: string;

  @ApiPropertyOptional({ example: 'uuid-production-order-id' })
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @ApiProperty({ example: 3000, description: 'Planned quantity (boxes/cartons)' })
  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  plannedQty!: number;

  @ApiProperty({ example: '2026-06-06T07:30:00.000Z' })
  @IsDateString()
  plannedStart!: string;

  @ApiProperty({ example: '2026-06-06T19:30:00.000Z' })
  @IsDateString()
  plannedEnd!: string;

  @ApiProperty({ enum: WOPriority, example: WOPriority.HIGH })
  @IsEnum(WOPriority)
  priority!: WOPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateWorkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  plannedQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @ApiPropertyOptional({ enum: WOPriority })
  @IsOptional()
  @IsEnum(WOPriority)
  priority?: WOPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class StartWorkOrderDto {
  @ApiPropertyOptional({ example: 'uuid-operator-id' })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class CompleteWorkOrderDto {
  @ApiProperty({ example: 2950, description: 'Actual quantity produced' })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  actualQty!: number;

  @ApiPropertyOptional({ example: 2900 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goodQty?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  scrapQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class HoldWorkOrderDto {
  @ApiProperty({ example: 'Machine breakdown — waiting for spare part' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class CancelWorkOrderDto {
  @ApiProperty({ example: 'Cancelled by supervisor — SKU changed' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class RecordCountDto {
  @ApiProperty({ example: 150, description: 'Good units produced since last update' })
  @IsInt()
  @Min(0)
  goodCount!: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rejectCount?: number;

  @ApiPropertyOptional({ example: 'uuid-shift-instance-id' })
  @IsOptional()
  @IsUUID()
  shiftInstanceId?: string;
}

export class WorkOrderFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
