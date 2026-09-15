"use client";

import { useRef, useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { DiaryEntry, Stage } from "@/lib/types";

export function DiaryPanel({
  projectId,
  initialEntries,
  stages,
  stageFilter,
}: {
  projectId: string;
  initialEntries: DiaryEntry[];
  stages: Stage[];
  /** Show only this stage's entries; omit to show only unassigned ("Bez etapu") ones. */
  stageFilter?: string;
}) {
  const t = useTranslations("diary");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const queryKey = ["diary", projectId];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allEntries = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<DiaryEntry[]>(`/projects/${projectId}/diary`),
    initialData: initialEntries,
  });
  const entries = allEntries.filter((entry) =>
    stageFilter !== undefined ? entry.stageId === stageFilter : entry.stageId === null,
  );

  const [text, setText] = useState("");
  const [stageId, setStageId] = useState(stageFilter ?? "");
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
            throw new Error(t("photoUploadFailed"));
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
      setStageId(stageFilter ?? "");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ClientApiError || err instanceof Error ? err.message : t("genericAddError")),
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
      <h2 className="mb-3 text-xl font-semibold">{t("title")}</h2>
      {entries.length === 0 ? (
        <p className="mb-4 text-base text-gray-600">{t("empty")}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border border-gray-200 px-3 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base text-gray-600">
                    {new Date(entry.createdAt).toLocaleString("pl-PL")} · {entry.author.email}
                    {stageName(entry.stageId) ? ` · ${stageName(entry.stageId)}` : ""}
                  </p>
                  <p className="mt-1 text-base">{entry.text}</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(t("confirmDelete"))) deleteEntry.mutate(entry.id);
                  }}
                  className="text-base text-red-600 underline"
                >
                  {tc("delete")}
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
          placeholder={t("placeholder")}
          rows={2}
          className="rounded border border-gray-300 px-3 py-2 text-base"
        />
        <div className="flex flex-wrap items-end gap-2">
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
          <label className="flex flex-col gap-1">
            <span className="text-base text-gray-700">{t("photos")}</span>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="text-base" />
          </label>
          <button
            type="submit"
            disabled={createEntry.isPending}
            className="rounded bg-gray-900 px-4 py-2 text-base text-white disabled:opacity-50"
          >
            {createEntry.isPending ? t("saving") : t("add")}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-base text-red-600">{error}</p>}
    </section>
  );
}
