import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "./config";

// No [locale] URL segment — the language is remembered in a cookie
// (LanguageSwitcher + setLocale) instead of prefixing every route, so
// existing bookmarks/links keep working unchanged.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
