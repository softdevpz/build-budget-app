"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Report, ReportStatus } from "@/lib/types";

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Generowanie...",
  completed: "Gotowy",
  failed: "Błąd",
};

const POLL_INTERVAL_MS = 3000;

export function ReportPanel({ projectId, initialReports }: { projectId: string; initialReports: Report[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["reports", projectId];

  const { data: reports = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<Report[]>(`/projects/${projectId}/reports`),
    initialData: initialReports,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((report) => report.status === "pending") ? POLL_INTERVAL_MS : false;
    },
  });

  const [error, setError] = useState<string | null>(null);

  const requestReport = useMutation({
    mutationFn: () => apiFetch<Report>(`/projects/${projectId}/reports`, { method: "POST" }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się zamówić raportu"),
  });

  // The list endpoint doesn't include a downloadUrl (presigned URLs expire in
  // 5 minutes, so eagerly attaching one to every row would go stale) — only
  // GET /reports/:id does, fetched fresh at click time.
  const downloadReport = useMutation({
    mutationFn: (reportId: string) => apiFetch<Report>(`/projects/${projectId}/reports/${reportId}`),
    onSuccess: (report) => {
      if (report.downloadUrl) window.open(report.downloadUrl, "_blank");
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się pobrać raportu"),
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Raporty bankowe</h2>
        <button
          onClick={() => requestReport.mutate()}
          disabled={requestReport.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Wygeneruj raport
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-gray-500">Brak raportów.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="font-medium">{new Date(report.requestedAt).toLocaleString("pl-PL")}</p>
                {report.status === "failed" && report.error && (
                  <p className="text-xs text-red-600">{report.error}</p>
                )}
              </div>
              {report.status === "completed" ? (
                <button
                  onClick={() => downloadReport.mutate(report.id)}
                  disabled={downloadReport.isPending}
                  className="text-sm underline disabled:opacity-50"
                >
                  Pobierz PDF
                </button>
              ) : (
                <span className="text-sm text-gray-500">{STATUS_LABELS[report.status]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
