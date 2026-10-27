"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectSummary } from "@/lib/types";

export function BudgetChart({ summary }: { summary: ProjectSummary }) {
  const data = [
    ...summary.stages.map((stage) => ({
      name: stage.name,
      wydane: stage.spent,
    })),
    ...(summary.unassignedSpent > 0 ? [{ name: "Bez etapu", wydane: summary.unassignedSpent }] : []),
  ]
    // Biggest spend first — makes it obvious at a glance which stage ate the
    // most of the budget, instead of following stage creation order.
    .sort((a, b) => b.wydane - a.wydane);

  if (data.length === 0) {
    return <p className="text-base text-muted">Dodaj etap, żeby zobaczyć wykres budżetu.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 56, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            fontSize={12}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={70}
          />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value: number) => `${value.toLocaleString("pl-PL")} PLN`} />
          {/* Recharts needs a literal color, not a CSS var — kept in sync by
              hand with the --accent-fill token in globals.css. */}
          <Bar dataKey="wydane" fill="#f07a1e" name="Wydane" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
