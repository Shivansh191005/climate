/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          low: "#16a34a",
          moderate: "#f59e0b",
          high: "#dc2626",
        },
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
