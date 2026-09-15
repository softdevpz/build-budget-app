"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Stage, Task } from "@/lib/types";

export function TaskPanel({
  projectId,
  initialTasks,
  stages,
  stageFilter,
}: {
  projectId: string;
  initialTasks: Task[];
  stages: Stage[];
  /** Show only this stage's tasks; omit to show only unassigned ("Bez etapu") ones. */
  stageFilter?: string;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const queryKey = ["tasks", projectId];

  const { data: allTasks = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<Task[]>(`/projects/${projectId}/tasks`),
    initialData: initialTasks,
  });
  const tasks = allTasks.filter((task) =>
    stageFilter !== undefined ? task.stageId === stageFilter : task.stageId === null,
  );

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stageId, setStageId] = useState(stageFilter ?? "");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const createTask = useMutation({
    mutationFn: () =>
      apiFetch<Task>(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: {
          title,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          stageId: stageId || undefined,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setDueDate("");
      setStageId(stageFilter ?? "");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : t("genericAddError")),
  });

  const toggleDone = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body: { done } }),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => apiFetch<void>(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate();
  }

  function isOverdue(task: Task) {
    return !task.done && task.dueDate && new Date(task.dueDate) < new Date();
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{t("title")}</h2>
      {tasks.length === 0 ? (
        <p className="mb-4 text-base text-gray-600">{t("empty")}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(e) => toggleDone.mutate({ taskId: task.id, done: e.target.checked })}
                />
                <span>
                  <p className={task.done ? "line-through text-gray-500" : "font-medium"}>{task.title}</p>
                  {task.dueDate && (
                    <p className={`text-base ${isOverdue(task) ? "text-red-600" : "text-gray-600"}`}>
                      {t("dueDateLabel", { date: new Date(task.dueDate).toLocaleDateString("pl-PL") })}
                      {isOverdue(task) ? t("overdueSuffix") : ""}
                    </p>
                  )}
                </span>
              </label>
              <button
                onClick={() => {
                  if (confirm(t("confirmDelete", { title: task.title }))) deleteTask.mutate(task.id);
                }}
                className="text-base text-red-600 underline"
              >
                {tc("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("nameLabel")}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("dueDate")}</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("stage")}</span>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-base"
          >
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
          disabled={createTask.isPending}
          className="rounded bg-gray-900 px-4 py-2 text-base text-white disabled:opacity-50"
        >
          {t("add")}
        </button>
      </form>
      {error && <p className="mt-2 text-base text-red-600">{error}</p>}
    </section>
  );
}
