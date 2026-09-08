import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/cookies";

export default async function HomePage() {
  if (await getAccessToken()) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Budżet budowy domu</h1>
      <p className="text-gray-600">
        Śledź budżet, dokumentację i harmonogram budowy w jednym miejscu.
      </p>
      <div className="flex gap-4">
        <Link href="/register" className="rounded bg-gray-900 px-4 py-2 text-white">
          Załóż konto
        </Link>
        <Link href="/login" className="rounded border border-gray-300 px-4 py-2">
          Zaloguj się
        </Link>
      </div>
    </main>
  );
}
