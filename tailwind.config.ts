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
          primary: "#BAB58C", // Pistachio accent
          secondary: "#A8A37A",
          accent: "#E27D60",
          neutral: "#121A16",
          "neutral-content": "#ECF2EE",
          "base-100": "#18221D", // Deep Pine Green background
          "base-200": "#121A16", // Darker Pine Green for cards
          "base-300": "#0c120f", // Borders
          "base-content": "#ECF2EE", // Warm soft white text
          info: "#0ca5e9",
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
        },
        light: {
          "color-scheme": "light",
          primary: "#57401C", // Bronze accent
          secondary: "#443013",
          accent: "#8A2E2B",
          neutral: "#F4EFEA",
          "neutral-content": "#1C1B14",
          "base-100": "#BAB58C", // Pistachio background
          "base-200": "#A8A37A", // Darker pistachio for cards
          "base-300": "#98936A", // Borders
          "base-content": "#1C1B14", // Dark text
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
