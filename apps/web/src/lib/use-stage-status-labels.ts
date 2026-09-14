"use client";

import { useTranslations } from "next-intl";
import type { StageStatus } from "./types";

// Used from both stage-panel.tsx (the list's status <select>) and
// stage-workspace.tsx (the stage detail header's status <select>).
export function useStageStatusLabels(): Record<StageStatus, string> {
  const t = useTranslations("stages");
  return {
    pending: t("statusPending"),
    in_progress: t("statusInProgress"),
    done: t("statusDone"),
  };
}
