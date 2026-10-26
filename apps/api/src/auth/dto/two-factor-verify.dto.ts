import { IsString } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  challengeId!: string;

  @IsString()
  code!: string;
}
