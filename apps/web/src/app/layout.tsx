import Link from "next/link";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getAccessToken } from "@/lib/cookies";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Providers } from "./providers";

export const metadata = {
  title: "Budżet budowy",
  description: "Zarządzanie budżetem i dokumentacją budowy domu",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = Boolean(await getAccessToken());
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("nav");

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <Link href="/" className="font-semibold">
              {t("brand")}
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/benchmark" className="text-base underline">
                {t("benchmark")}
              </Link>
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="text-base underline">
                    {t("dashboard")}
                  </Link>
                  <Link href="/billing" className="text-base underline">
                    {t("billing")}
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="text-base underline">
                    {t("login")}
                  </Link>
                  <Link href="/register" className="text-base underline">
                    {t("register")}
                  </Link>
                </>
              )}
              <LanguageSwitcher />
            </nav>
          </header>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
