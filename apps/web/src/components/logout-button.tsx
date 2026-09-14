"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function LogoutButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} disabled={isLoggingOut} className="text-sm underline disabled:opacity-50">
      {t("logout")}
    </button>
  );
}
