/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#014fa4",
        secondary: "#FF9800",
        kihapYellow: "#eab308",
        kihapGold: "#e5a700",
      },
      fontFamily: {
        machina: ["NeueMachina-Regular", "sans-serif"],
        machinaBold: ["NeueMachina-Ultrabold", "sans-serif"],
      },
    },
  },
  plugins: [],
};
