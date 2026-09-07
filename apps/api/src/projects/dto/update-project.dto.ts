import { IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

const PROJECT_STATUSES = ['in_progress', 'on_hold', 'completed'] as const;

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  areaM2?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetBudget?: number;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: (typeof PROJECT_STATUSES)[number];
}
