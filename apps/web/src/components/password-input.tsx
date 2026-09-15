"use client";

import { useState, InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("passwordInput");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${props.className ?? ""} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-gray-600 underline"
      >
        {visible ? t("hide") : t("show")}
      </button>
    </div>
  );
}
