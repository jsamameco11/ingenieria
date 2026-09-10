import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12161c",
        paper: "#f3efe6",
        navy: {
          950: "#07111f",
          900: "#0b1c33",
          800: "#123056",
          700: "#1a4473",
          600: "#245b96",
        },
        brass: {
          400: "#d4b36a",
          500: "#c49a48",
          600: "#9e7630",
        },
        ok: "#1f7a4d",
        fail: "#a33b32",
        dim: "#1d5aa6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        sheet: "0 18px 50px -24px rgba(7, 17, 31, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
