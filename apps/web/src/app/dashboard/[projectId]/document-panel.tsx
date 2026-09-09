"use client";

import { useRef, useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import { DOCUMENT_TYPES, type DocumentType, type ProjectDocument, type Stage } from "@/lib/types";

const TYPE_LABELS: Record<DocumentType, string> = {
  invoice: "Faktura",
  contract: "Umowa",
  photo: "Zdjęcie",
};

export function DocumentPanel({
  projectId,
  initialDocuments,
  stages,
}: {
  projectId: string;
  initialDocuments: ProjectDocument[];
  stages: Stage[];
}) {
  const queryClient = useQueryClient();
  const queryKey = ["documents", projectId];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<ProjectDocument[]>(`/projects/${projectId}/documents`),
    initialData: initialDocuments,
  });

  const [type, setType] = useState<DocumentType>("invoice");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || "application/octet-stream";
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `/projects/${projectId}/documents/presign`,
        { method: "POST", body: { fileName: file.name, contentType, type } },
      );

      // Goes straight to S3, bypassing our /api/proxy — the presigned URL's
      // signature is tied to this exact host/path, and our proxy only knows
      // how to forward to the Nest API anyway.
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!uploadRes.ok) {
        throw new Error("Nie udało się wysłać pliku");
      }

      return apiFetch<ProjectDocument>(`/projects/${projectId}/documents`, {
        method: "POST",
        body: { key, type, stageId: stageId || undefined },
      });
    },
    onSuccess: () => {
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStageId("");
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ClientApiError || err instanceof Error ? err.message : "Nie udało się dodać dokumentu"),
  });

  const deleteDocument = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<void>(`/projects/${projectId}/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    uploadDocument.mutate(file);
  }

  function stageName(id: string | null) {
    if (!id) return null;
    return stages.find((s) => s.id === id)?.name ?? null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Dokumenty</h2>
      {documents.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Brak dokumentów.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <a href={document.downloadUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                  {TYPE_LABELS[document.type]}
                </a>
                <p className="text-xs text-gray-500">
                  {new Date(document.uploadedAt).toLocaleDateString("pl-PL")}
                  {stageName(document.stageId) ? ` · ${stageName(document.stageId)}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Usunąć ten dokument?")) deleteDocument.mutate(document.id);
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
          <span className="text-xs text-gray-700">Typ</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
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
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">Plik</span>
          <input ref={fileInputRef} type="file" required className="text-sm" />
        </label>
        <button
          type="submit"
          disabled={uploadDocument.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {uploadDocument.isPending ? "Wysyłanie..." : "Dodaj dokument"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
