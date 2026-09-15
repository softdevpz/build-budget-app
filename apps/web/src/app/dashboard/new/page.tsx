"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Project } from "@/lib/types";

export default function NewProjectPage() {
  const t = useTranslations("newProject");
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetBudget, setTargetBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [planLimitReached, setPlanLimitReached] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPlanLimitReached(false);
    setIsSubmitting(true);

    try {
      const project = await apiFetch<Project>("/projects", {
        method: "POST",
        body: {
          name,
          address: address || undefined,
          region: region || undefined,
          areaM2: areaM2 ? Number(areaM2) : undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          targetBudget: targetBudget ? Number(targetBudget) : undefined,
        },
      });
      router.push(`/dashboard/${project.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 402) {
        setPlanLimitReached(true);
      } else {
        setError(err instanceof ClientApiError ? err.message : t("genericError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("name")}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("address")}</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("region")}</span>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("area")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={areaM2}
            onChange={(e) => setAreaM2(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("startDate")}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-gray-700">{t("targetBudget")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={targetBudget}
            onChange={(e) => setTargetBudget(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-base text-red-600">{error}</p>}
        {planLimitReached && (
          <p className="text-base text-red-600">
            {t.rich("planLimitReached", {
              upgrade: (chunks) => (
                <Link href="/billing" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </main>
  );
}
