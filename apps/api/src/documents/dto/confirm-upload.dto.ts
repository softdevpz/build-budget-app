import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DOCUMENT_TYPES, DocumentType } from './presign-upload.dto';

export class ConfirmUploadDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  diaryEntryId?: string;
}
