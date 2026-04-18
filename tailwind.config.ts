import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#F7F6F2",
        "surface-2": "#FBFAF7",
        ink: "#1A1A18",
        "ink-soft": "#2A2A27",
        border: "#E2E0D8",
        "border-strong": "#D8D5CA",
        muted: "#6B6A65",
        "muted-2": "#9A988F",
        // pastel accent — driven by CSS vars so they can be themed later
        pastel: "var(--pastel)",
        "pastel-ink": "var(--pastel-ink)",
        "pastel-tint": "var(--pastel-tint)",
        "pastel-deep": "var(--pastel-deep)",
        // semantic status colors
        "urgent-ink": "#8A4B1F",
        "urgent-tint": "#F6E6D4",
        "done-ink": "#5A5954",
        "done-tint": "#ECEBE4",
        // legacy accent (kept for non-status uses)
        accent: "#D97706",
        "accent-light": "#FEF3C7",
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 360ms ease-out both",
        "pop": "pop 280ms cubic-bezier(.2,.9,.3,1.2)",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        "breath": "breath 1.6s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
