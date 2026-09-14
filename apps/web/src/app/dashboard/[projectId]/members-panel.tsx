"use client";

import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import { PROJECT_ROLE_LABELS, type ProjectMember } from "@/lib/types";

export function MembersPanel({ projectId, initialMembers }: { projectId: string; initialMembers: ProjectMember[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["members", projectId];

  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: () => apiFetch<ProjectMember[]>(`/projects/${projectId}/members`),
    initialData: initialMembers,
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const inviteMember = useMutation({
    mutationFn: () =>
      apiFetch<ProjectMember>(`/projects/${projectId}/members`, { method: "POST", body: { email } }),
    onSuccess: () => {
      setEmail("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się zaprosić użytkownika"),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<void>(`/projects/${projectId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : "Nie udało się usunąć członka"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMember.mutate();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Współpracownicy</h2>
      <ul className="mb-4 flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
          >
            <div>
              <p className="font-medium">{member.user.email}</p>
              <p className="text-xs text-gray-500">{PROJECT_ROLE_LABELS[member.role] ?? member.role}</p>
            </div>
            {member.role !== "owner" && (
              <button
                onClick={() => {
                  if (confirm(`Usunąć ${member.user.email} z projektu?`)) removeMember.mutate(member.id);
                }}
                className="text-xs text-red-600 underline"
              >
                Usuń
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-700">E-mail osoby do zaproszenia</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={inviteMember.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Zaproś
        </button>
      </form>
      <p className="mt-1 text-xs text-gray-500">Zapraszana osoba musi już mieć konto w aplikacji.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
