/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: "#1e1e1e",
          sidebar: "#252526",
          header: "#2d2d30",
          border: "#3c3c3c",
          accent: "#007acc",
          hover: "#2a2d2e",
          active: "#094771",
          text: "#cccccc",
          "text-muted": "#888888",
        },
      },
      fontFamily: {
        mono: ["Consolas", "Monaco", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
