"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectSummary } from "@/lib/types";

export function BudgetChart({ summary }: { summary: ProjectSummary }) {
  const data = [
    ...summary.stages.map((stage) => ({
      name: stage.name,
      planowane: stage.plannedBudget ?? 0,
      wydane: stage.spent,
    })),
    ...(summary.unassignedSpent > 0
      ? [{ name: "Bez etapu", planowane: 0, wydane: summary.unassignedSpent }]
      : []),
  ];

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">Dodaj etap, żeby zobaczyć wykres budżetu.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value: number) => `${value.toLocaleString("pl-PL")} PLN`} />
          <Legend />
          <Bar dataKey="planowane" fill="#9ca3af" name="Planowane" />
          <Bar dataKey="wydane" fill="#111827" name="Wydane" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
