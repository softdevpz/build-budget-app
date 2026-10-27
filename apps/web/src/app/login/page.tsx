"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oauth_failed" ? t("oauthFailed") : null,
  );
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set directly from the URL when Google's own callback found the account
  // has 2FA enabled (see AuthController.googleCallback) — skips straight to
  // the code prompt below, no password step needed a second time.
  const [challengeId, setChallengeId] = useState<string | null>(searchParams.get("twoFactorChallenge"));
  const [twoFactorCode, setTwoFactorCode] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendStatus("idle");
    setIsSubmitting(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (res.status === 403) {
        setNeedsVerification(true);
      } else {
        setError(data?.message ?? t("genericError"));
      }
      return;
    }

    const data = await res.json();
    if (data.twoFactorRequired) {
      // Password was correct, but the account has 2FA — one more step
      // before a session actually gets granted (see /api/auth/2fa-verify).
      setChallengeId(data.challengeId);
      return;
    }

    router.push(searchParams.get("from") ?? "/dashboard");
    router.refresh();
  }

  async function handleTwoFactorSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/auth/2fa-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, code: twoFactorCode }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? t("twoFactorError"));
      return;
    }

    router.push(searchParams.get("from") ?? "/dashboard");
    router.refresh();
  }

  async function handleResend() {
    setResendStatus("sending");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResendStatus("sent");
  }

  if (challengeId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
        <h1 className="mb-2 font-display text-2xl font-semibold">{t("twoFactorTitle")}</h1>
        <p className="mb-6 text-base text-muted">{t("twoFactorSubtitle")}</p>
        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-base text-muted">{t("twoFactorCode")}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
            />
          </label>
          {error && <p className="text-base text-danger">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
          >
            {isSubmitting ? t("submitting") : t("twoFactorSubmit")}
          </button>
        </form>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        {error && <p className="text-base text-danger">{error}</p>}
        {needsVerification && (
          <div className="rounded-lg border border-line bg-surface p-3 text-base">
            <p>{t("needsVerification")}</p>
            {resendStatus === "sent" ? (
              <p className="mt-1 text-ok">{t("resendSent")}</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendStatus === "sending"}
                className="mt-1 text-accent underline disabled:opacity-50"
              >
                {resendStatus === "sending" ? t("resending") : t("resend")}
              </button>
            )}
          </div>
        )}
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
      {/* Plain navigation, not a fetch — this has to leave our origin so the
          browser lands on Google's own consent screen. */}
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
        className="rounded-lg border border-line px-4 py-2 text-center transition-colors hover:bg-surface"
      >
        {t("googleButton")}
      </a>
      <p className="mt-4 text-base text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-accent underline">
          {t("registerLink")}
        </Link>
      </p>
    </main>
  );
}
