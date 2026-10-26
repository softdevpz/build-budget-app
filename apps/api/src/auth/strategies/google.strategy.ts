import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile } from 'passport-google-oauth20';

export type GoogleProfile = {
  googleId: string;
  email: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      // Google accounts always have an email for this scope, but the type
      // doesn't guarantee it — fail loudly rather than create a user with
      // an undefined email.
      throw new Error('Google profile did not include an email address');
    }
    return { googleId: profile.id, email };
  }
}
