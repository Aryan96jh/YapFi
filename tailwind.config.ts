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
        navy: "#181739",
        gold: "#E8B84B",
        cyan: "#35D0E0",
        ink: "#F5F7FF",
        muted: "#A5AFCD",
      },
    },
  },
  plugins: [],
};
export default config;
