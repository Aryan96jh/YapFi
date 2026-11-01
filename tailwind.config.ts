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
        paper: "#FFFFFF",
        ink: "#141414",
        muted: "#6B7280",
        faint: "#9CA3AF",
        line: "#E5E7EB",
        wash: "#F9FAFB",
        gold: "#E8B84B",
        cyan: "#35D0E0",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 12px 48px rgba(20, 20, 20, 0.07)",
        pop: "0 8px 32px rgba(20, 20, 20, 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
