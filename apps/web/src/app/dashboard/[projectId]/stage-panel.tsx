"use client";

import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Stage, StageStatus } from "@/lib/types";

const STATUS_LABELS: Record<StageStatus, string> = {
  pending: "Zaplanowany",
  in_progress: "W trakcie",
  done: "Zakończony",
};

export function StagePanel({ projectId, initialStages }: { projectId: string; initialStages: Stage[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["stages", projectId];

  const { data: stages = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<Stage[]>(`/projects/${projectId}/stages`),
    initialData: initialStages,
  });

  const [name, setName] = useState("");
  const [plannedBudget, setPlannedBudget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["summary", projectId] });
  }

  const createStage = useMutation({
    mutationFn: () =>
      apiFetch<Stage>(`/projects/${projectId}/stages`, {
        method: "POST",
        body: {
          name,
          order: stages.length,
          plannedBudget: plannedBudget ? Number(plannedBudget) : undefined,
        },
      }),
    onSuccess: () => {
      setName("");
      setPlannedBudget("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się dodać etapu"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ stageId, status }: { stageId: string; status: StageStatus }) =>
      apiFetch<Stage>(`/projects/${projectId}/stages/${stageId}`, { method: "PATCH", body: { status } }),
    onSuccess: invalidate,
  });

  const deleteStage = useMutation({
    mutationFn: (stageId: string) => apiFetch<void>(`/projects/${projectId}/stages/${stageId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createStage.mutate();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Etapy</h2>
      {stages.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Brak etapów.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="font-medium">{stage.name}</p>
                {stage.plannedBudget && (
                  <p className="text-xs text-gray-500">
                    Planowane: {Number(stage.plannedBudget).toLocaleString("pl-PL")} PLN
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={stage.status}
                  onChange={(e) =>
                    updateStatus.mutate({ stageId: stage.id, status: e.target.value as StageStatus })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm(`Usunąć etap "${stage.name}"?`)) deleteStage.mutate(stage.id);
                  }}
                  className="text-xs text-red-600 underline"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Nazwa etapu</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Planowany budżet</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={plannedBudget}
            onChange={(e) => setPlannedBudget(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={createStage.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Dodaj etap
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
