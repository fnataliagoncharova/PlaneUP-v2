/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#050b12",
          900: "#08111a",
          850: "#0b1622",
          800: "#0f1d2b",
        },
      },
      boxShadow: {
        shell: "0 32px 120px rgba(2, 10, 24, 0.65)",
        panel: "0 18px 48px rgba(3, 9, 20, 0.45)",
        cyanGlow: "0 0 0 1px rgba(34, 211, 238, 0.25), 0 0 30px rgba(34, 211, 238, 0.14)",
        amberGlow: "0 0 0 1px rgba(251, 191, 36, 0.32), 0 0 34px rgba(251, 191, 36, 0.18)",
      },
      backgroundImage: {
        "tech-grid":
          "linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
