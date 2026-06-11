import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RunScheduleDto {
  @ApiPropertyOptional({ description: 'Schedule forward from this instant (defaults to now)' })
  @IsOptional() @IsDateString()
  startFrom?: string;

  @ApiPropertyOptional({ description: 'Recalculate ONLY this work order — other open jobs keep their plan and pre-occupy their machines' })
  @IsOptional() @IsUUID('4')
  workOrderId?: string;
}

export class RescheduleJobDto {
  @ApiProperty({ description: 'Job order to move' })
  @IsUUID('4')
  jobId!: string;

  @ApiPropertyOptional({ description: 'Move to a different machine' })
  @IsOptional() @IsUUID('4')
  machineId?: string;

  @ApiProperty({ description: 'New planned start (ISO)' })
  @IsDateString()
  start!: string;

  @ApiPropertyOptional({ description: 'New planned end (ISO) — if omitted, keeps the same duration' })
  @IsOptional() @IsDateString()
  end?: string;
}

export class CtpDto {
  @ApiProperty({ description: 'SKU to promise' })
  @IsUUID('4')
  skuId!: string;

  @ApiProperty({ example: 1000, description: 'Requested quantity' })
  @Type(() => Number) @IsInt() @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Customer requested date (ISO) — feasibility is checked against it' })
  @IsOptional() @IsDateString()
  dueDate?: string;
}
