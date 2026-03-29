import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09131C",
        moss: "#DCE8D2",
        fairway: "#5FB36A",
        sand: "#F4E7CF",
        ember: "#E77751",
        slate: "#688290"
      },
      boxShadow: {
        panel: "0 14px 50px rgba(9, 19, 28, 0.08)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top, rgba(95,179,106,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(231,119,81,0.12), transparent 22%)"
      }
    }
  },
  plugins: []
};

export default config;
