import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "fade-in": "fadeInCurtain 0.3s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeInCurtain: {
          from: { opacity: "0", transform: "scale(0.99)" },
          to: { opacity: "1", transform: "scale(1)" },
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
          primary: "#22d3ee", // Vibrant Cyan
          secondary: "#06b6d4", // Teal / Deep Cyan
          accent: "#38bdf8", // Sky Blue
          neutral: "#082f49", // Dark Cyan Navy
          "neutral-content": "#f0fdfa",
          "base-100": "#100e0b", // Dark backdrop matching Liquid Cyan
          "base-200": "#0e1e24", // Deep glass cyan tint
          "base-300": "#163842", // Subtle cyan glass borders
          "base-content": "#f0fdfa", // Crisp soft white/cyan text
          info: "#38bdf8",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#f43f5e",
        },
        light: {
          "color-scheme": "light",
          primary: "#0891b2", // Ocean Cyan
          secondary: "#0284c7", // Sky Blue
          accent: "#06b6d4", // Aqua
          neutral: "#f3efe6", // Warm sand neutral
          "neutral-content": "#0f172a",
          "base-100": "#faf8f2", // Light backdrop matching Aqua Bubble
          "base-200": "#f0ede4", // Subtle warm glass card tint
          "base-300": "#e2ddd2", // Border tone
          "base-content": "#0f172a", // Deep slate text
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
