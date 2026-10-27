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
        className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
      >
        {isLoading ? t("redirecting") : t("upgrade")}
      </button>
      {error && <p className="mt-2 text-base text-danger">{error}</p>}
    </div>
  );
}
