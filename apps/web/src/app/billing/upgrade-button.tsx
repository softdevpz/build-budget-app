"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch, ClientApiError } from "@/lib/api-client";

export function UpgradeButton() {
  const t = useTranslations("billing");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/billing/checkout-session", { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t("genericCheckoutError"));
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isLoading ? t("redirecting") : t("upgrade")}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
