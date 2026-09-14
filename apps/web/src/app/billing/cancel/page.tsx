import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function BillingCancelPage() {
  const t = await getTranslations("billing");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="mb-4 text-2xl font-semibold">{t("cancelTitle")}</h1>
      <p className="text-gray-600">{t("cancelBody")}</p>
      <Link href="/billing" className="mt-4 underline">
        {t("backToPlan")}
      </Link>
    </main>
  );
}
