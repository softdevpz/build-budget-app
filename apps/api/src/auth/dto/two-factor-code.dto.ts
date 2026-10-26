import { IsString } from 'class-validator';

// Shared by /2fa/enable and /2fa/disable — both just take a single code,
// which may be a 6-digit TOTP token or (for disable) a backup code.
export class TwoFactorCodeDto {
  @IsString()
  code!: string;
}
