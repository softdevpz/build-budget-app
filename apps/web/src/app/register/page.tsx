"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PasswordInput } from "@/components/password-input";
import { PASSWORD_POLICY_PATTERN } from "@build-budget-app/shared";

export default function RegisterPage() {
  const t = useTranslations("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
      setError(message ?? t("genericError"));
      return;
    }

    setRegistered(true);
  }

  if (registered) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="mb-4 text-2xl font-semibold">{t("checkEmailTitle")}</h1>
        <p className="text-gray-600">
          {t.rich("checkEmailBody", { email, strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("password")}</span>
          <PasswordInput
            required
            minLength={8}
            pattern={PASSWORD_POLICY_PATTERN}
            title={t("passwordTitle")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
          <span className="text-base text-gray-600">{t("passwordHint")}</span>
        </label>
        {error && <p className="text-base text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </form>
      <p className="mt-4 text-base text-gray-600">
        {t("hasAccount")}{" "}
        <Link href="/login" className="underline">
          {t("loginLink")}
        </Link>
      </p>
    </main>
  );
}
