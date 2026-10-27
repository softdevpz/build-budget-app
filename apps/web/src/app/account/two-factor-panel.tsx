"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import type { TwoFactorEnableResult, TwoFactorSetup } from "@/lib/types";

type Step = "status" | "setup" | "backup-codes" | "disable";

export function TwoFactorPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("account");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("status");
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleStartSetup() {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiFetch<TwoFactorSetup>("/auth/2fa/setup", { method: "POST" });
      setSetupData(data);
      setStep("setup");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmSetup() {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiFetch<TwoFactorEnableResult>("/auth/2fa/enable", { method: "POST", body: { code } });
      setBackupCodes(data.backupCodes);
      setCode("");
      setStep("backup-codes");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch("/auth/2fa/disable", { method: "POST", body: { code } });
      setEnabled(false);
      setCode("");
      setStep("status");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleDoneWithBackupCodes() {
    setEnabled(true);
    setBackupCodes([]);
    setSetupData(null);
    setStep("status");
  }

  if (step === "backup-codes") {
    return (
      <div className="rounded-lg border border-accent/30 bg-surface p-4">
        <h2 className="mb-2 font-display text-xl font-semibold">{t("backupCodesTitle")}</h2>
        <p className="mb-4 text-base text-muted">{t("backupCodesBody")}</p>
        <ul className="mb-4 grid grid-cols-2 gap-2 font-mono text-base">
          {backupCodes.map((backupCode) => (
            <li key={backupCode} className="rounded bg-bg px-2 py-1">
              {backupCode}
            </li>
          ))}
        </ul>
        <button
          onClick={handleDoneWithBackupCodes}
          className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent"
        >
          {t("backupCodesConfirm")}
        </button>
      </div>
    );
  }

  if (step === "setup" && setupData) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-xl font-semibold">{t("setupTitle")}</h2>
        <p className="mb-4 text-base text-muted">{t("setupBody")}</p>
        {/* A generated data: URI, not a remote image — next/image's domain
            allowlist doesn't apply, but its sizing props are still required. */}
        <Image src={setupData.qrCodeDataUrl} alt={t("qrCodeAlt")} width={200} height={200} className="mb-4" unoptimized />
        <p className="mb-4 break-all text-base text-muted">
          {t("manualEntry")}: <span className="font-mono">{setupData.secret}</span>
        </p>
        <label className="mb-4 flex flex-col gap-1">
          <span className="text-base text-muted">{t("codeLabel")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        {error && <p className="mb-4 text-base text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConfirmSetup}
            disabled={isLoading || code.length === 0}
            className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
          >
            {isLoading ? t("verifying") : t("confirm")}
          </button>
          <button
            onClick={() => setStep("status")}
            className="rounded-lg border border-line px-4 py-2 transition-colors hover:bg-bg"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-xl font-semibold">{t("disableTitle")}</h2>
        <p className="mb-4 text-base text-muted">{t("disableBody")}</p>
        <label className="mb-4 flex flex-col gap-1">
          <span className="text-base text-muted">{t("codeLabel")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
          />
        </label>
        {error && <p className="mb-4 text-base text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDisable}
            disabled={isLoading || code.length === 0}
            className="rounded-lg bg-danger px-4 py-2 text-white disabled:opacity-50"
          >
            {isLoading ? t("verifying") : t("disableConfirm")}
          </button>
          <button
            onClick={() => setStep("status")}
            className="rounded-lg border border-line px-4 py-2 transition-colors hover:bg-bg"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-2 font-display text-xl font-semibold">{t("twoFactorTitle")}</h2>
      <p className="mb-4 text-base text-muted">{enabled ? t("statusEnabled") : t("statusDisabled")}</p>
      {error && <p className="mb-4 text-base text-danger">{error}</p>}
      {enabled ? (
        <button
          onClick={() => {
            setError(null);
            setStep("disable");
          }}
          className="rounded-lg border border-danger px-4 py-2 text-danger"
        >
          {t("disableButton")}
        </button>
      ) : (
        <button
          onClick={handleStartSetup}
          disabled={isLoading}
          className="rounded-lg bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent disabled:opacity-50"
        >
          {isLoading ? t("verifying") : t("enableButton")}
        </button>
      )}
    </div>
  );
}
