/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        energy: {
          green: "#22c55e",
          amber: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
