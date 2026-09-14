import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Płatność anulowana</h1>
      <p className="text-gray-600">Nie pobrano żadnej opłaty. Możesz spróbować ponownie w dowolnym momencie.</p>
      <Link href="/billing" className="mt-4 underline">
        Wróć do planu
      </Link>
    </main>
  );
}
