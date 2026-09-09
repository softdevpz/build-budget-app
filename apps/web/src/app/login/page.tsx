"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setError(data?.message ?? "Nie udało się zalogować");
      }
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Zaloguj się</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Hasło</span>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {needsVerification && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p>Musisz najpierw potwierdzić adres e-mail.</p>
            {resendStatus === "sent" ? (
              <p className="mt-1 text-green-700">Wysłaliśmy nowy link, sprawdź skrzynkę.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendStatus === "sending"}
                className="mt-1 underline disabled:opacity-50"
              >
                {resendStatus === "sending" ? "Wysyłanie..." : "Wyślij link ponownie"}
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Logowanie..." : "Zaloguj się"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Nie masz konta?{" "}
        <Link href="/register" className="underline">
          Zarejestruj się
        </Link>
      </p>
    </main>
  );
}
