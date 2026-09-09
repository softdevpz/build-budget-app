"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { Project } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetBudget, setTargetBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
        setError("Twój darmowy plan pozwala tylko na 1 projekt. Ulepsz do Premium, żeby dodać kolejny.");
      } else {
        setError(err instanceof ClientApiError ? err.message : "Nie udało się utworzyć projektu");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Nowy projekt</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Nazwa</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Adres</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Region</span>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Powierzchnia (m²)</span>
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
          <span className="text-sm text-gray-700">Data rozpoczęcia</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Budżet docelowy</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={targetBudget}
            onChange={(e) => setTargetBudget(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Tworzenie..." : "Utwórz projekt"}
        </button>
      </form>
    </main>
  );
}
