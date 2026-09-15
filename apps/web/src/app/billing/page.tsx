import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { BillingStatus } from "@/lib/types";
import { UpgradeButton } from "./upgrade-button";

export default async function BillingPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }
  const t = await getTranslations("billing");

  const { status, data } = await callNestApi("/billing/status", { token });
  const billing: BillingStatus = status === 200 ? (data as BillingStatus) : { plan: "free", subscription: null };

  const statusLabels: Record<string, string> = {
    active: t("statusActive"),
    trialing: t("statusTrialing"),
    past_due: t("statusPastDue"),
    canceled: t("statusCanceled"),
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>

      <div className="mb-6 rounded border border-gray-200 px-4 py-3">
        <p className="text-base text-gray-600">{t("currentPlan")}</p>
        <p className="text-xl font-semibold">{billing.plan === "premium" ? t("planPremium") : t("planFree")}</p>
        {billing.subscription && (
          <p className="mt-1 text-base text-gray-600">
            {t("statusLine", {
              status: statusLabels[billing.subscription.status] ?? billing.subscription.status,
              date: new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("pl-PL"),
            })}
          </p>
        )}
      </div>

      {billing.plan === "free" ? (
        <>
          <p className="mb-4 text-base text-gray-600">{t("freeDescription")}</p>
          <UpgradeButton />
        </>
      ) : (
        <p className="text-base text-gray-600">{t("premiumThanks")}</p>
      )}
    </main>
  );
}
