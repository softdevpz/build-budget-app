"use client";

import { useState, InputHTMLAttributes } from "react";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${props.className ?? ""} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 underline"
      >
        {visible ? "Ukryj" : "Pokaż"}
      </button>
    </div>
  );
}
