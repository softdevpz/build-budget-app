import { IsEmail, Matches, MinLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_PATTERN } from '@build-budget-app/shared';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  @Matches(new RegExp(PASSWORD_POLICY_PATTERN), { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}
