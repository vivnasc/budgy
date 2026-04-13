import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10B981",
          50: "rgba(16, 185, 129, 0.08)",
          100: "rgba(16, 185, 129, 0.12)",
          200: "rgba(16, 185, 129, 0.20)",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
          950: "#022C22",
        },
        dark: {
          DEFAULT: "#0F172A",
          50: "#1E293B",
          100: "#1A2332",
          200: "#162032",
          300: "#0F172A",
          400: "#0D1424",
          500: "#0B111E",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          light: "rgba(255, 255, 255, 0.08)",
          medium: "rgba(255, 255, 255, 0.10)",
          strong: "rgba(255, 255, 255, 0.15)",
        },
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "0.85rem" }],
      },
      backdropBlur: {
        "2xl": "40px",
        "3xl": "64px",
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(16, 185, 129, 0.15)",
        "glow-md": "0 0 30px rgba(16, 185, 129, 0.2)",
        "glow-lg": "0 0 50px rgba(16, 185, 129, 0.25)",
        "dark-sm": "0 2px 8px rgba(0, 0, 0, 0.3)",
        "dark-md": "0 4px 16px rgba(0, 0, 0, 0.4)",
        "dark-lg": "0 8px 32px rgba(0, 0, 0, 0.5)",
      },
      borderColor: {
        glass: "rgba(255, 255, 255, 0.1)",
        "glass-light": "rgba(255, 255, 255, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
