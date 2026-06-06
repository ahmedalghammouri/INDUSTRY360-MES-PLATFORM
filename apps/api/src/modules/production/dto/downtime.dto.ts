import {
  IsString, IsUUID, IsBoolean, IsOptional, IsDateString,
  IsEnum, MaxLength, IsInt, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DowntimeCategory {
  MECHANICAL = 'MECHANICAL',
  ELECTRICAL = 'ELECTRICAL',
  PROCESS = 'PROCESS',
  MATERIAL = 'MATERIAL',
  OPERATOR = 'OPERATOR',
  CHANGEOVER = 'CHANGEOVER',
  UTILITY = 'UTILITY',
  QUALITY = 'QUALITY',
  PLANNED_MAINTENANCE = 'PLANNED_MAINTENANCE',
  PLANNED_CLEANING = 'PLANNED_CLEANING',
  PLANNED_BREAK = 'PLANNED_BREAK',
  EXTERNAL = 'EXTERNAL',
  OTHER = 'OTHER',
}

export class CreateDowntimeEventDto {
  @ApiProperty({ example: 'uuid-machine-id' })
  @IsUUID()
  machineId!: string;

  @ApiPropertyOptional({ example: 'uuid-work-order-id' })
  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @ApiPropertyOptional({ example: 'uuid-cause-id' })
  @IsOptional()
  @IsUUID()
  causeId?: string;

  @ApiPropertyOptional({ example: 'Cartoning machine feeder jam' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({ enum: DowntimeCategory })
  @IsEnum(DowntimeCategory)
  category!: DowntimeCategory;

  @ApiProperty({ example: '2026-06-06T08:15:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional({ example: '2026-06-06T08:42:00.000Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPlanned?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateDowntimeEventDto {
  @ApiPropertyOptional({ example: 'uuid-cause-id' })
  @IsOptional()
  @IsUUID()
  causeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ enum: DowntimeCategory })
  @IsOptional()
  @IsEnum(DowntimeCategory)
  category?: DowntimeCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class EndDowntimeEventDto {
  @ApiProperty({ example: '2026-06-06T08:42:00.000Z' })
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional({ example: 'uuid-cause-id' })
  @IsOptional()
  @IsUUID()
  causeId?: string;

  @ApiPropertyOptional({ example: 'Jam cleared, production resumed' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;
}

export class AcknowledgeDowntimeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
