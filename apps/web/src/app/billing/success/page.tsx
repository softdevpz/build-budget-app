import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Dziękujemy!</h1>
      <p className="text-gray-600">
        Twoja płatność się powiodła. Aktywacja planu Premium może potrwać do minuty — Stripe potwierdza ją
        asynchronicznie w tle.
      </p>
      <Link href="/billing" className="mt-4 underline">
        Sprawdź status planu
      </Link>
    </main>
  );
}
