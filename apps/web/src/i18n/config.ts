export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE = "pl";
export const SUPPORTED_LOCALES = ["pl", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
