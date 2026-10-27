import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { TwoFactorStatus } from "@/lib/types";
import { TwoFactorPanel } from "./two-factor-panel";

export default async function AccountPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }
  const t = await getTranslations("account");

  const { status, data } = await callNestApi("/auth/2fa/status", { token });
  const twoFactor: TwoFactorStatus = status === 200 ? (data as TwoFactorStatus) : { enabled: false };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 font-display text-2xl font-semibold">{t("title")}</h1>
      <TwoFactorPanel initialEnabled={twoFactor.enabled} />
    </main>
  );
}
