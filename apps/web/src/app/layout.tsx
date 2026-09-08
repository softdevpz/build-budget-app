import Link from "next/link";
import "./globals.css";
import { getAccessToken } from "@/lib/cookies";
import { LogoutButton } from "@/components/logout-button";

export const metadata = {
  title: "Budżet budowy",
  description: "Zarządzanie budżetem i dokumentacją budowy domu",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = Boolean(await getAccessToken());

  return (
    <html lang="pl">
      <body>
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <Link href="/" className="font-semibold">
            Budżet budowy
          </Link>
          <nav className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm underline">
                  Pulpit
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm underline">
                  Zaloguj się
                </Link>
                <Link href="/register" className="text-sm underline">
                  Załóż konto
                </Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
