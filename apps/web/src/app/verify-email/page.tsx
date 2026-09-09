"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("success");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1500);
      })
      .catch(() => setStatus("error"));
    // Only re-run if the token itself changes — router is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      {status === "verifying" && <p>Potwierdzanie adresu e-mail...</p>}
      {status === "success" && <p>Konto potwierdzone! Przenoszę do pulpitu...</p>}
      {status === "error" && (
        <>
          <h1 className="mb-4 text-xl font-semibold">Link jest nieprawidłowy lub wygasł</h1>
          <p className="text-gray-600">
            Wróć do{" "}
            <Link href="/login" className="underline">
              logowania
            </Link>{" "}
            i poproś o nowy link.
          </p>
        </>
      )}
    </main>
  );
}
