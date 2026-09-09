"use client";

import { useRef, useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { DiaryEntry, Stage } from "@/lib/types";

export function DiaryPanel({
  projectId,
  initialEntries,
  stages,
}: {
  projectId: string;
  initialEntries: DiaryEntry[];
  stages: Stage[];
}) {
  const queryClient = useQueryClient();
  const queryKey = ["diary", projectId];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: entries = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<DiaryEntry[]>(`/projects/${projectId}/diary`),
    initialData: initialEntries,
  });

  const [text, setText] = useState("");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const createEntry = useMutation({
    mutationFn: async () => {
      const entry = await apiFetch<DiaryEntry>(`/projects/${projectId}/diary`, {
        method: "POST",
        body: { text, stageId: stageId || undefined },
      });

      const files = fileInputRef.current?.files;
      if (files) {
        for (const file of Array.from(files)) {
          const contentType = file.type || "application/octet-stream";
          const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
            `/projects/${projectId}/documents/presign`,
            { method: "POST", body: { fileName: file.name, contentType, type: "photo" } },
          );
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": contentType },
          });
          if (!uploadRes.ok) {
            throw new Error("Nie udało się wysłać jednego ze zdjęć");
          }
          await apiFetch(`/projects/${projectId}/documents`, {
            method: "POST",
            body: { key, type: "photo", diaryEntryId: entry.id },
          });
        }
      }

      return entry;
    },
    onSuccess: () => {
      setText("");
      setStageId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ClientApiError || err instanceof Error ? err.message : "Nie udało się dodać wpisu"),
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => apiFetch<void>(`/projects/${projectId}/diary/${entryId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    createEntry.mutate();
  }

  function stageName(id: string | null) {
    if (!id) return null;
    return stages.find((s) => s.id === id)?.name ?? null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Dziennik budowy</h2>
      {entries.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Brak wpisów.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border border-gray-200 px-3 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.createdAt).toLocaleString("pl-PL")} · {entry.author.email}
                    {stageName(entry.stageId) ? ` · ${stageName(entry.stageId)}` : ""}
                  </p>
                  <p className="mt-1 text-sm">{entry.text}</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Usunąć ten wpis?")) deleteEntry.mutate(entry.id);
                  }}
                  className="text-xs text-red-600 underline"
                >
                  Usuń
                </button>
              </div>
              {entry.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.photos.map((photo) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={photo.id} href={photo.downloadUrl} target="_blank" rel="noreferrer">
                      <img
                        src={photo.downloadUrl}
                        alt=""
                        className="h-16 w-16 rounded border border-gray-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Co się dziś działo na budowie?"
          rows={2}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="flex flex-wrap items-end gap-2">
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-700">Zdjęcia</span>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="text-sm" />
          </label>
          <button
            type="submit"
            disabled={createEntry.isPending}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {createEntry.isPending ? "Zapisywanie..." : "Dodaj wpis"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
