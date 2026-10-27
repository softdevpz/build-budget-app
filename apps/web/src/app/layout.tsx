import Link from "next/link";
import { Instrument_Sans, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getAccessToken } from "@/lib/cookies";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Providers } from "./providers";

// Runs before paint (a regular <script>, not "use client" — this needs to
// execute in the raw HTML response, before React/hydration exist at all),
// so there's never a flash of the wrong theme while JS loads. Mirrors
// ThemeToggle's own read of the same localStorage key.
const noFlashThemeScript = `
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
`;

export const metadata = {
  title: "Budżet budowy",
  description: "Zarządzanie budżetem i dokumentacją budowy domu",
};

// Same three typefaces as ziecina.dev, exposed as CSS variables that
// tailwind.config.js's fontFamily.sans/display/mono point at.
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const bricolageGrotesque = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = Boolean(await getAccessToken());
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("nav");

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${bricolageGrotesque.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="flex flex-col gap-y-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="font-semibold">
              {t("brand")}
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                  <Link href="/account" className="text-base underline">
                    {t("account")}
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
              <ThemeToggle />
            </nav>
          </header>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
