"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Expense, Stage } from "@/lib/types";

export function ExpensePanel({
  projectId,
  initialExpenses,
  stages,
  stageFilter,
}: {
  projectId: string;
  initialExpenses: Expense[];
  stages: Stage[];
  /** Show only this stage's expenses; omit to show only unassigned ("Bez etapu") ones. */
  stageFilter?: string;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const queryKey = ["expenses", projectId];

  const { data: allExpenses = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<Expense[]>(`/projects/${projectId}/expenses`),
    initialData: initialExpenses,
  });
  const expenses = allExpenses.filter((expense) =>
    stageFilter !== undefined ? expense.stageId === stageFilter : expense.stageId === null,
  );

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [stageId, setStageId] = useState(stageFilter ?? "");
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
      setStageId(stageFilter ?? "");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : t("genericAddError")),
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
    if (!id) return t("noStage");
    return stages.find((s) => s.id === id)?.name ?? t("noStage");
  }

  const inputClass = "rounded-lg border border-line bg-bg px-3 py-2 text-base focus:border-accent focus:outline-none";

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold">{t("title")}</h2>
      {expenses.length === 0 ? (
        <p className="mb-4 text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {expense.category} — {Number(expense.amount).toLocaleString("pl-PL")} {expense.currency}
                </p>
                <p className="text-base text-muted">
                  {new Date(expense.date).toLocaleDateString("pl-PL")} · {stageName(expense.stageId)}
                  {expense.vendor ? ` · ${expense.vendor}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(t("confirmDelete", { category: expense.category }))) deleteExpense.mutate(expense.id);
                }}
                className="text-base text-danger underline"
              >
                {tc("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("category")}</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("amount")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-28 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("vendor")}</span>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-muted">{t("stage")}</span>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
            <option value="">{t("noStage")}</option>
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
          className="rounded-lg bg-accent-fill px-4 py-2 text-base text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
        >
          {t("add")}
        </button>
      </form>
      {error && <p className="mt-2 text-base text-danger">{error}</p>}
    </section>
  );
}
