"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import { getStageBudgetWarning } from "@/lib/budget-warning";
import { useProjectSocket } from "@/lib/use-project-socket";
import { useStageStatusLabels } from "@/lib/use-stage-status-labels";
import {
  type DiaryEntry,
  type Expense,
  type Project,
  type ProjectDocument,
  type ProjectSummary,
  type Stage,
  type StageStatus,
  type Task,
} from "@/lib/types";
import { ExpensePanel } from "../../expense-panel";
import { DocumentPanel } from "../../document-panel";
import { DiaryPanel } from "../../diary-panel";
import { TaskPanel } from "../../task-panel";

export function StageWorkspace({
  projectId,
  project,
  initialStage,
  summary: initialSummary,
  stages: initialStages,
  initialExpenses,
  initialDocuments,
  initialDiaryEntries,
  initialTasks,
}: {
  projectId: string;
  project: Project;
  initialStage: Stage;
  summary: ProjectSummary;
  stages: Stage[];
  initialExpenses: Expense[];
  initialDocuments: ProjectDocument[];
  initialDiaryEntries: DiaryEntry[];
  initialTasks: Task[];
}) {
  const t = useTranslations("stages");
  const statusLabels = useStageStatusLabels();
  const queryClient = useQueryClient();

  useProjectSocket(projectId, () => {
    queryClient.invalidateQueries({ queryKey: ["stages", projectId] });
    queryClient.invalidateQueries({ queryKey: ["expenses", projectId] });
    queryClient.invalidateQueries({ queryKey: ["summary", projectId] });
  });

  // Same query keys the project workspace/StagePanel use — mutations made in
  // any of the tiles below (adding an expense, etc.) invalidate ["summary",
  // projectId], which this page picks up automatically via the shared cache.
  const { data: stages = initialStages } = useQuery({
    queryKey: ["stages", projectId],
    queryFn: () => apiFetch<Stage[]>(`/projects/${projectId}/stages`),
    initialData: initialStages,
  });
  const stage = stages.find((s) => s.id === initialStage.id) ?? initialStage;

  const { data: summary = initialSummary } = useQuery({
    queryKey: ["summary", projectId],
    queryFn: () => apiFetch<ProjectSummary>(`/projects/${projectId}/summary`),
    initialData: initialSummary,
  });

  const [statusError, setStatusError] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: (status: StageStatus) =>
      apiFetch<Stage>(`/projects/${projectId}/stages/${stage.id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      setStatusError(null);
      queryClient.invalidateQueries({ queryKey: ["stages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["summary", projectId] });
    },
    onError: (err) => setStatusError(err instanceof ClientApiError ? err.message : t("genericStatusError")),
  });

  const warning = getStageBudgetWarning(stage, summary, t);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link href={`/dashboard/${projectId}`} className="text-base underline">
        {t("backTo", { name: project.name })}
      </Link>

      <div className="mb-2 mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{stage.name}</h1>
          {stage.plannedBudget && (
            <p className="text-base text-gray-600">
              {t("planned", { amount: Number(stage.plannedBudget).toLocaleString("pl-PL") })}
            </p>
          )}
          {warning && (
            <p className={`text-base ${warning.isOver ? "text-red-600" : "text-amber-600"}`}>{warning.message}</p>
          )}
        </div>
        <select
          value={stage.status}
          onChange={(e) => updateStatus.mutate(e.target.value as StageStatus)}
          className="rounded border border-gray-300 px-3 py-2 text-base"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {statusError && <p className="mb-4 text-base text-red-600">{statusError}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-gray-200 p-4">
          <ExpensePanel
            projectId={projectId}
            initialExpenses={initialExpenses}
            stages={stages}
            stageFilter={stage.id}
          />
        </div>
        <div className="rounded border border-gray-200 p-4">
          <DocumentPanel
            projectId={projectId}
            initialDocuments={initialDocuments}
            stages={stages}
            stageFilter={stage.id}
          />
        </div>
        <div className="rounded border border-gray-200 p-4">
          <DiaryPanel
            projectId={projectId}
            initialEntries={initialDiaryEntries}
            stages={stages}
            stageFilter={stage.id}
          />
        </div>
        <div className="rounded border border-gray-200 p-4">
          <TaskPanel projectId={projectId} initialTasks={initialTasks} stages={stages} stageFilter={stage.id} />
        </div>
      </div>
    </main>
  );
}
