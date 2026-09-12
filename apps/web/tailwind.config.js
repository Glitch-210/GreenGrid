/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "on-surface": "#1b1b1b",
        "on-surface-variant": "#3e4a3d",
        outline: "#6e7b6c",
        solar: {
          DEFAULT: "#22C55E",
          dark: "#166534",
          bright: "#16A34A",
        },
        grid: {
          DEFAULT: "#0047FF",
        },
        alert: {
          DEFAULT: "#FFD600",
        },
        fault: {
          DEFAULT: "#FF3B30",
        },
        // legacy tokens kept until fully migrated
        energy: {
          green: "#22c55e",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        display: ["\"Space Grotesk\"", "sans-serif"],
        mono: ["\"JetBrains Mono\"", "monospace"],
        body: ["Inter", "sans-serif"],
      },
      borderWidth: {
        3: "3px",
      },
      boxShadow: {
        hard: "4px 4px 0px #000000",
        "hard-sm": "2px 2px 0px #000000",
        "hard-lg": "5px 5px 0px #000000",
        none: "none",
      },
      borderRadius: {
        DEFAULT: "0px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};
