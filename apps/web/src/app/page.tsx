import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAccessToken } from "@/lib/cookies";

export default async function HomePage() {
  if (await getAccessToken()) {
    redirect("/dashboard");
  }
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("subtitle")}</p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent"
        >
          {t("register")}
        </Link>
        <Link href="/login" className="rounded-lg border border-line px-4 py-2 transition-colors hover:bg-surface">
          {t("login")}
        </Link>
      </div>
    </main>
  );
}
