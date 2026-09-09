"use client";

import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Expense, Stage } from "@/lib/types";

export function ExpensePanel({
  projectId,
  initialExpenses,
  stages,
}: {
  projectId: string;
  initialExpenses: Expense[];
  stages: Stage[];
}) {
  const queryClient = useQueryClient();
  const queryKey = ["expenses", projectId];

  const { data: expenses = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<Expense[]>(`/projects/${projectId}/expenses`),
    initialData: initialExpenses,
  });

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["summary", projectId] });
  }

  const createExpense = useMutation({
    mutationFn: () =>
      apiFetch<Expense>(`/projects/${projectId}/expenses`, {
        method: "POST",
        body: {
          category,
          amount: Number(amount),
          date: new Date(date).toISOString(),
          vendor: vendor || undefined,
          stageId: stageId || undefined,
        },
      }),
    onSuccess: () => {
      setCategory("");
      setAmount("");
      setVendor("");
      setStageId("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się dodać wydatku"),
  });

  const deleteExpense = useMutation({
    mutationFn: (expenseId: string) =>
      apiFetch<void>(`/projects/${projectId}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category.trim() || !amount) return;
    createExpense.mutate();
  }

  function stageName(id: string | null) {
    if (!id) return "Bez etapu";
    return stages.find((s) => s.id === id)?.name ?? "Bez etapu";
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Wydatki</h2>
      {expenses.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Brak wydatków.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {expense.category} — {Number(expense.amount).toLocaleString("pl-PL")} {expense.currency}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(expense.date).toLocaleDateString("pl-PL")} · {stageName(expense.stageId)}
                  {expense.vendor ? ` · ${expense.vendor}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Usunąć wydatek "${expense.category}"?`)) deleteExpense.mutate(expense.id);
                }}
                className="text-xs text-red-600 underline"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Kategoria</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Kwota</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Dostawca</span>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Etap</span>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Bez etapu</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={createExpense.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Dodaj wydatek
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
