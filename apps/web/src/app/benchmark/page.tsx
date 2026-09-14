import { callNestApi } from "@/lib/api-server";
import type { BenchmarkStat } from "@/lib/types";
import { BenchmarkTable } from "./benchmark-table";

// Public and anonymous on purpose — mirrors GET /benchmark, which requires
// no auth (see the comment in benchmark.controller.ts). No login check here.
export default async function BenchmarkPage() {
  const { status, data } = await callNestApi("/benchmark");
  const stats = status === 200 ? (data as BenchmarkStat[]) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Porównanie kosztów budowy</h1>
      <p className="mb-6 text-sm text-gray-600">
        Średni koszt na m² wyliczony anonimowo z wydatków wszystkich projektów w aplikacji, w podziale na region i
        etap budowy.
      </p>

      {stats.length === 0 ? (
        <p className="text-sm text-gray-500">
          Za mało danych, żeby pokazać wiarygodne porównanie — wróć, gdy więcej projektów zgromadzi wydatki.
        </p>
      ) : (
        <BenchmarkTable stats={stats} />
      )}
    </main>
  );
}
