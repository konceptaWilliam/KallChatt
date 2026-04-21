/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A18",
        surface: "#F7F6F2",
        muted: "#888780",
        border: "#E2E0D8",
        accent: "#D97706",
        "status-open-bg": "#E6F1FB",
        "status-open-text": "#0C447C",
        "status-open-border": "#85B7EB",
        "status-urgent-bg": "#FAEEDA",
        "status-urgent-text": "#633806",
        "status-urgent-border": "#EF9F27",
        "status-done-bg": "#EAF3DE",
        "status-done-text": "#27500A",
        "status-done-border": "#97C459",
      },
      fontFamily: {
        mono: ["Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
