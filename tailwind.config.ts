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
          primary: "#8b5cf6", // Violet glow matching Aura Layer 2
          secondary: "#6366f1", // Indigo glow matching Aura Layer 3
          accent: "#c084fc", // Lilac / Purple accent
          neutral: "#181424", // Deep Obsidian neutral
          "neutral-content": "#f3f4f6",
          "base-100": "#100e0b", // Obsidian base backdrop
          "base-200": "#181424", // Obsidian Glass card tint
          "base-300": "#262035", // Subtle glass borders
          "base-content": "#f3f4f6", // Crisp white text
          info: "#38bdf8",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#f43f5e",
        },
        light: {
          "color-scheme": "light",
          primary: "#7c3aed",
          secondary: "#4f46e5",
          accent: "#9333ea",
          neutral: "#f5f5f4",
          "neutral-content": "#1c1917",
          "base-100": "#fafaf9",
          "base-200": "#f5f5f4",
          "base-300": "#e7e5e4",
          "base-content": "#1c1917",
          info: "#0284c7",
          success: "#16a34a",
          warning: "#d97706",
          error: "#dc2626",
        }
      }
    ],
  },
};

export default config;
