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
          primary: "#18221D", // Deep Pine Green highlight
          secondary: "#26362D", // Muted Pine charcoal
          accent: "#8A2E2B", // Rust Red accent
          neutral: "#B8CDBC", // Rich Greenish Pistachio background
          "neutral-content": "#14221A",
          "base-100": "#B8CDBC", // Rich Greenish Pistachio background
          "base-200": "#A6BCA8", // Deeper cards
          "base-300": "#94AA96", // Borders
          "base-content": "#14221A", // Deep Pine Charcoal text
          info: "#06b6d4",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#f43f5e",
        }
      }
    ],
  },
};

export default config;
