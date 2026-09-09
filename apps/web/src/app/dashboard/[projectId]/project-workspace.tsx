"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Expense, Project, ProjectSummary, Stage } from "@/lib/types";
import { BudgetChart } from "./budget-chart";
import { StagePanel } from "./stage-panel";
import { ExpensePanel } from "./expense-panel";

export function ProjectWorkspace({
  projectId,
  initialProject,
  initialSummary,
  initialStages,
  initialExpenses,
}: {
  projectId: string;
  initialProject: Project;
  initialSummary: ProjectSummary;
  initialStages: Stage[];
  initialExpenses: Expense[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: project = initialProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<Project>(`/projects/${projectId}`),
    initialData: initialProject,
  });

  const { data: summary = initialSummary } = useQuery({
    queryKey: ["summary", projectId],
    queryFn: () => apiFetch<ProjectSummary>(`/projects/${projectId}/summary`),
    initialData: initialSummary,
  });

  const { data: stages = initialStages } = useQuery({
    queryKey: ["stages", projectId],
    queryFn: () => apiFetch<Stage[]>(`/projects/${projectId}/stages`),
    initialData: initialStages,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [targetBudget, setTargetBudget] = useState(project.targetBudget ?? "");
  const [actionError, setActionError] = useState<string | null>(null);

  const updateProject = useMutation({
    mutationFn: () =>
      apiFetch<Project>(`/projects/${projectId}`, {
        method: "PATCH",
        body: { name, targetBudget: targetBudget ? Number(targetBudget) : undefined },
      }),
    onSuccess: () => {
      setIsEditing(false);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["summary", projectId] });
    },
    onError: (err) => setActionError(err instanceof ClientApiError ? err.message : "Nie udało się zapisać zmian"),
  });

  const deleteProject = useMutation({
    mutationFn: () => apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => setActionError(err instanceof ClientApiError ? err.message : "Nie udało się usunąć projektu"),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-start justify-between">
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProject.mutate();
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-lg font-semibold"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetBudget}
              onChange={(e) => setTargetBudget(e.target.value)}
              placeholder="Budżet docelowy"
              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={updateProject.isPending}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Zapisz
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm underline">
              Anuluj
            </button>
          </form>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.address && <p className="text-sm text-gray-500">{project.address}</p>}
          </div>
        )}
        {!isEditing && (
          <div className="flex gap-3">
            <button onClick={() => setIsEditing(true)} className="text-sm underline">
              Edytuj
            </button>
            <button
              onClick={() => {
                if (confirm(`Usunąć projekt "${project.name}" wraz z całą zawartością?`)) deleteProject.mutate();
              }}
              className="text-sm text-red-600 underline"
            >
              Usuń projekt
            </button>
          </div>
        )}
      </div>
      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      <div className="mb-8 grid grid-cols-3 gap-4">
        <SummaryCard label="Budżet docelowy" value={summary.targetBudget} />
        <SummaryCard label="Wydano" value={summary.totalSpent} />
        <SummaryCard label="Pozostało" value={summary.remaining} />
      </div>

      <div className="mb-8">
        <BudgetChart summary={summary} />
      </div>

      <div className="mb-8">
        <StagePanel projectId={projectId} initialStages={stages} />
      </div>

      <ExpensePanel projectId={projectId} initialExpenses={initialExpenses} stages={stages} />
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value !== null ? `${value.toLocaleString("pl-PL")} PLN` : "—"}</p>
    </div>
  );
}
