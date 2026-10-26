export const SALT_ROUNDS = 10;
export const VERIFICATION_TOKEN_TTL_HOURS = 24;

// One-time code handed to the browser in the Google OAuth redirect, swapped
// for the real token pair by the frontend's own server (never the tokens
// themselves — that URL is otherwise logged, cached, and kept in history).
export const OAUTH_CODE_PREFIX = 'oauth-code:';
export const OAUTH_CODE_TTL_SECONDS = 60;
