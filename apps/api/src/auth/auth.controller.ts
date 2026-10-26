import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayloadWithRefreshToken } from './types/jwt-payload.type';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@CurrentUser() user: JwtPayloadWithRefreshToken) {
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayloadWithRefreshToken) {
    return this.authService.logout(user.sub);
  }

  // Passport's GoogleStrategy intercepts the request before this body runs
  // — it only ever exists to trigger the redirect to Google's consent screen.
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: { user: GoogleProfile }, @Res() res: Response) {
    const result = await this.authService.findOrCreateGoogleUser(req.user);

    if ('twoFactorRequired' in result) {
      // No token to protect yet, so no need for the one-time-code
      // indirection below — the challenge id itself grants nothing without
      // also producing a valid code (see verifyTwoFactorChallenge). The
      // login page shows the code prompt directly for this query param.
      res.redirect(`${process.env.WEB_APP_URL}/login?twoFactorChallenge=${result.challengeId}`);
      return;
    }

    const code = await this.authService.issueOAuthCode(result);
    res.redirect(`${process.env.WEB_APP_URL}/api/auth/oauth-callback?code=${code}`);
  }

  @HttpCode(HttpStatus.OK)
  @Post('oauth-exchange')
  oauthExchange(@Body() dto: OAuthExchangeDto) {
    return this.authService.exchangeOAuthCode(dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  getTwoFactorStatus(@CurrentUser() user: JwtPayloadWithRefreshToken) {
    return this.authService.getTwoFactorStatus(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: JwtPayloadWithRefreshToken) {
    return this.authService.setupTwoFactor(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/enable')
  enableTwoFactor(@CurrentUser() user: JwtPayloadWithRefreshToken, @Body() dto: TwoFactorCodeDto) {
    return this.authService.enableTwoFactor(user.sub, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser() user: JwtPayloadWithRefreshToken, @Body() dto: TwoFactorCodeDto) {
    return this.authService.disableTwoFactor(user.sub, dto.code);
  }

  // No guard: happens mid-login, before a session exists — challengeId
  // (minted only after the password check already passed) stands in for
  // auth here, the same way the OAuth one-time code does above.
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  verifyTwoFactorChallenge(@Body() dto: TwoFactorVerifyDto) {
    return this.authService.verifyTwoFactorChallenge(dto.challengeId, dto.code);
  }
}
