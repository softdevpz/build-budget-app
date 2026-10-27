"use client";

import { useState, type ReactNode } from "react";

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium"
      >
        <span>{title}</span>
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-line p-3">{children}</div>}
    </div>
  );
}
