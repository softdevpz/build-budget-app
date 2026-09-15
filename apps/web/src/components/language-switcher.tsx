"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/locale-actions";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, string> = { pl: "PL", en: "EN" };

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(next: Locale) {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 text-base">
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => handleClick(code)}
          disabled={isPending || code === locale}
          className={code === locale ? "font-semibold underline" : "underline opacity-60"}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
