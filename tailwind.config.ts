import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="night"]'],
  theme: {
    extend: {
      fontFamily: {
        outfit: ["var(--font-outfit)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 5s ease-in-out infinite",
        "fade-in": "fadeIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-up": "slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-up": "scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleUp: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        night: {
          "color-scheme": "dark",
          primary: "#10b981", // Crisp Emerald Green
          secondary: "#38bdf8", // Sky Cyan
          accent: "#818cf8", // Soft Indigo
          neutral: "#1e293b", // Slate Neutral
          "neutral-content": "#f8fafc",
          "base-100": "#0a0e14", // Obsidian Dark Canvas
          "base-200": "#121822", // Card Surface
          "base-300": "#1e293b", // Crisp 1px Borders
          "base-content": "#f8fafc", // High-contrast clean typography
          info: "#38bdf8",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#f43f5e",
        },
        light: {
          "color-scheme": "light",
          primary: "#0d9488", // Deep Forest Teal
          secondary: "#0284c7", // Cobalt Ocean
          accent: "#6366f1", // Indigo
          neutral: "#f1f5f9", // Crisp light neutral
          "neutral-content": "#0f172a",
          "base-100": "#faf9f6", // Warm Porcelain Canvas
          "base-200": "#ffffff", // Pure White Card Surface
          "base-300": "#e2e8f0", // Clean hairline border
          "base-content": "#0f172a", // Deep Slate typography
          info: "#0284c7",
          success: "#059669",
          warning: "#d97706",
          error: "#dc2626",
        },
      },
    ],
  },
};

export default config;

