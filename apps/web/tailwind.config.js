/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Mirrors ziecina.dev's design tokens exactly (same hex values), so
      // this project reads as the same portfolio rather than a separate
      // generic-Tailwind app. CSS custom properties (globals.css) carry the
      // actual light/dark values; these just name them for use as classes
      // (bg-accent, text-fg, border-line, ...).
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          fill: 'var(--accent-fill)',
        },
        'on-accent': 'var(--on-accent)',
        ok: 'var(--ok)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-instrument)', 'Helvetica Neue', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['var(--font-bricolage)', 'Avenir Next', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
