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
        <h1 className="mb-4 font-display text-2xl font-semibold">{t("checkEmailTitle")}</h1>
        <p className="text-muted">
          {t.rich("checkEmailBody", { email, strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 font-display text-2xl font-semibold">{t("title")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("password")}</span>
          <PasswordInput
            required
            minLength={8}
            pattern={PASSWORD_POLICY_PATTERN}
            title={t("passwordTitle")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
          />
          <span className="text-base text-muted">{t("passwordHint")}</span>
        </label>
        {error && <p className="text-base text-danger">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </form>
      <div className="my-4 flex items-center gap-3 text-base text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("orContinueWith")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
        className="rounded-lg border border-line px-4 py-2 text-center transition-colors hover:bg-surface"
      >
        {t("googleButton")}
      </a>
      <p className="mt-4 text-base text-muted">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-accent underline">
          {t("loginLink")}
        </Link>
      </p>
    </main>
  );
}
