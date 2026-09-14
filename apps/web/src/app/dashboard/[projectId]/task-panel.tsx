"use client";

import { useState, FormEvent } from "react";
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
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się dodać zadania"),
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
      <h2 className="mb-3 text-lg font-semibold">Zadania</h2>
      {tasks.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Brak zadań.</p>
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
                  <p className={task.done ? "line-through text-gray-400" : "font-medium"}>{task.title}</p>
                  {task.dueDate && (
                    <p className={`text-xs ${isOverdue(task) ? "text-red-600" : "text-gray-500"}`}>
                      Termin: {new Date(task.dueDate).toLocaleDateString("pl-PL")}
                      {isOverdue(task) ? " — po terminie" : ""}
                    </p>
                  )}
                </span>
              </label>
              <button
                onClick={() => {
                  if (confirm(`Usunąć zadanie "${task.title}"?`)) deleteTask.mutate(task.id);
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
          <span className="text-xs text-gray-700">Nazwa zadania</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Termin (opcjonalnie)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
          disabled={createTask.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Dodaj zadanie
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
