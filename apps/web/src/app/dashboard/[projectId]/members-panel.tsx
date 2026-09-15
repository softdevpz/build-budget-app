"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { ProjectMember } from "@/lib/types";

export function MembersPanel({ projectId, initialMembers }: { projectId: string; initialMembers: ProjectMember[] }) {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const roleLabels: Record<ProjectMember["role"], string> = {
    owner: t("roleOwner"),
    editor: t("roleEditor"),
  };
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
    onError: (err) => setError(err instanceof ClientApiError ? err.message : t("genericInviteError")),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<void>(`/projects/${projectId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ClientApiError ? err.message : t("genericRemoveError")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMember.mutate();
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{t("title")}</h2>
      <ul className="mb-4 flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
          >
            <div>
              <p className="font-medium">{member.user.email}</p>
              <p className="text-base text-gray-600">{roleLabels[member.role]}</p>
            </div>
            {member.role !== "owner" && (
              <button
                onClick={() => {
                  if (confirm(t("confirmRemove", { email: member.user.email }))) removeMember.mutate(member.id);
                }}
                className="text-base text-red-600 underline"
              >
                {tc("delete")}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("emailLabel")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={inviteMember.isPending}
          className="rounded bg-gray-900 px-4 py-2 text-base text-white disabled:opacity-50"
        >
          {t("invite")}
        </button>
      </form>
      <p className="mt-1 text-base text-gray-600">{t("hint")}</p>
      {error && <p className="mt-2 text-base text-red-600">{error}</p>}
    </section>
  );
}
