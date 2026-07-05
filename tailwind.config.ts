import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        night: {
          "color-scheme": "dark",
          primary: "#06b6d4",
          secondary: "#8b5cf6",
          accent: "#f43f5e",
          neutral: "#1e293b",
          "neutral-content": "#f8fafc",
          "base-100": "#0f172a",
          "base-200": "#1e293b",
          "base-300": "#334155",
          "base-content": "#f8fafc",
          info: "#0ca5e9",
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
        },
        light: {
          "color-scheme": "light",
          primary: "#0891b2",
          secondary: "#7c3aed",
          accent: "#e11d48",
          neutral: "#f1f5f9",
          "neutral-content": "#0f172a",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#f1f5f9",
          "base-content": "#0f172a",
          info: "#06b6d4",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#f43f5e",
        }
      }
    ],
  },
};

export default config;
