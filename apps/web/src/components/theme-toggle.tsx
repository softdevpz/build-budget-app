"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getStoredOrSystemTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  // Starts null so the server-rendered and first client render match (both
  // render nothing) — the inline script in layout.tsx already set the real
  // attribute before paint, this just syncs the button's own label/icon.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getStoredOrSystemTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  if (!theme) return null;

  return (
    <button onClick={toggle} aria-label="Toggle theme" className="text-base">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
