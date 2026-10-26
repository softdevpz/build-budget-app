export const SALT_ROUNDS = 10;
export const VERIFICATION_TOKEN_TTL_HOURS = 24;

// One-time code handed to the browser in the Google OAuth redirect, swapped
// for the real token pair by the frontend's own server (never the tokens
// themselves — that URL is otherwise logged, cached, and kept in history).
export const OAUTH_CODE_PREFIX = 'oauth-code:';
export const OAUTH_CODE_TTL_SECONDS = 60;

export const TOTP_ISSUER = 'Budzet budowy';

// Holds "this user passed the password check" between login and the 2FA
// code prompt — on its own it grants nothing (see verifyTwoFactorChallenge).
export const TWO_FACTOR_CHALLENGE_PREFIX = '2fa-challenge:';
export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 300;

export const BACKUP_CODES_COUNT = 8;
