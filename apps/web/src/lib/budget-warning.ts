import type { ProjectSummary, Stage } from "./types";

// Mirrors the "X% budżetu etapu wykorzystane" warning pattern from Staveo —
// surface the overrun before/as it happens, not just in the final total.
const BUDGET_WARNING_THRESHOLD = 0.9;

export interface StageBudgetWarning {
  message: string;
  isOver: boolean;
}

// Takes the caller's own useTranslations("stages") result rather than
// calling the hook itself — this is a plain utility function, not a
// component/hook, so it can't call hooks on its own without breaking the
// rules of hooks.
type Translator = (key: string, values?: Record<string, string | number>) => string;

export function getStageBudgetWarning(
  stage: Stage,
  summary: ProjectSummary,
  t: Translator,
): StageBudgetWarning | null {
  if (!stage.plannedBudget) return null;
  const spent = summary.stages.find((s) => s.id === stage.id)?.spent ?? 0;
  const planned = Number(stage.plannedBudget);
  const ratio = spent / planned;
  if (ratio < BUDGET_WARNING_THRESHOLD) return null;
  const pct = Math.round(ratio * 100);
  return {
    isOver: ratio >= 1,
    message: ratio >= 1 ? t("warningOver", { pct }) : t("warningApproaching", { pct }),
  };
}
