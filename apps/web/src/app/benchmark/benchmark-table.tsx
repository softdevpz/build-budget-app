"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BenchmarkStat } from "@/lib/types";

export function BenchmarkTable({ stats }: { stats: BenchmarkStat[] }) {
  const t = useTranslations("benchmark");
  const [region, setRegion] = useState("");
  const [stageCategory, setStageCategory] = useState("");

  const regions = useMemo(() => Array.from(new Set(stats.map((s) => s.region))).sort(), [stats]);
  const stageCategories = useMemo(
    () => Array.from(new Set(stats.map((s) => s.stageCategory))).sort(),
    [stats],
  );

  const filtered = stats.filter(
    (stat) => (!region || stat.region === region) && (!stageCategory || stat.stageCategory === stageCategory),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-base"
        >
          <option value="">{t("allRegions")}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={stageCategory}
          onChange={(e) => setStageCategory(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-base"
        >
          <option value="">{t("allStages")}</option>
          {stageCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-base text-gray-600">{t("noResults")}</p>
      ) : (
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-gray-200 text-base uppercase tracking-wide text-gray-600">
              <th className="py-2">{t("region")}</th>
              <th className="py-2">{t("stage")}</th>
              <th className="py-2">{t("avgCost")}</th>
              <th className="py-2">{t("samples")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stat) => (
              <tr key={`${stat.region}-${stat.stageCategory}`} className="border-b border-gray-100">
                <td className="py-2">{stat.region}</td>
                <td className="py-2 capitalize">{stat.stageCategory}</td>
                <td className="py-2">{stat.avgCostPerM2.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} PLN</td>
                <td className="py-2 text-gray-600">{stat.sampleSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
