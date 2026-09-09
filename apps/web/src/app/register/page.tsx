"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { PASSWORD_POLICY_PATTERN } from "@build-budget-app/shared";

export default function RegisterPage() {
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
      setError(message ?? "Nie udało się utworzyć konta");
      return;
    }

    setRegistered(true);
  }

  if (registered) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Sprawdź swoją skrzynkę e-mail</h1>
        <p className="text-gray-600">
          Wysłaliśmy link potwierdzający na <strong>{email}</strong>. Kliknij go, żeby dokończyć rejestrację i się
          zalogować.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Załóż konto</h1>
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
            minLength={8}
            pattern={PASSWORD_POLICY_PATTERN}
            title="Minimum 8 znaków, w tym co najmniej jedna cyfra i jeden znak specjalny"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
          <span className="text-xs text-gray-500">Min. 8 znaków, co najmniej 1 cyfra i 1 znak specjalny</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Tworzenie konta..." : "Załóż konto"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Masz już konto?{" "}
        <Link href="/login" className="underline">
          Zaloguj się
        </Link>
      </p>
    </main>
  );
}
