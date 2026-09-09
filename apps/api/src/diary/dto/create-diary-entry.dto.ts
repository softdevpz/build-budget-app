import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDiaryEntryDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  stageId?: string;
}
