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
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-gray-600">{t("subtitle")}</p>
      <div className="flex gap-4">
        <Link href="/register" className="rounded bg-gray-900 px-4 py-2 text-white">
          {t("register")}
        </Link>
        <Link href="/login" className="rounded border border-gray-300 px-4 py-2">
          {t("login")}
        </Link>
      </div>
    </main>
  );
}
