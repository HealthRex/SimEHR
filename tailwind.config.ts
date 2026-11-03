import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ehr: {
          blue: "#1a5a8e",
          bluedk: "#0f3a5f",
          red: "#9b2237",
          rail: "#f4f6f9",
          line: "#d6dde6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
