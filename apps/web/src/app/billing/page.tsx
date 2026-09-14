import { redirect } from "next/navigation";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import { SUBSCRIPTION_STATUS_LABELS, type BillingStatus } from "@/lib/types";
import { UpgradeButton } from "./upgrade-button";

export default async function BillingPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const { status, data } = await callNestApi("/billing/status", { token });
  const billing: BillingStatus = status === 200 ? (data as BillingStatus) : { plan: "free", subscription: null };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Plan i płatności</h1>

      <div className="mb-6 rounded border border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500">Aktualny plan</p>
        <p className="text-lg font-semibold">{billing.plan === "premium" ? "Premium" : "Darmowy"}</p>
        {billing.subscription && (
          <p className="mt-1 text-xs text-gray-500">
            Status: {SUBSCRIPTION_STATUS_LABELS[billing.subscription.status] ?? billing.subscription.status} ·
            odnowienie{" "}
            {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("pl-PL")}
          </p>
        )}
      </div>

      {billing.plan === "free" ? (
        <>
          <p className="mb-4 text-sm text-gray-600">
            Plan darmowy pozwala na 1 projekt. Ulepsz do Premium, żeby zarządzać nieograniczoną liczbą projektów.
          </p>
          <UpgradeButton />
        </>
      ) : (
        <p className="text-sm text-gray-600">Masz nieograniczoną liczbę projektów. Dziękujemy za wsparcie!</p>
      )}
    </main>
  );
}
