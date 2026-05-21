import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Page surface — warm-toned white paper.
        paper: {
          DEFAULT: "#FFFFFF",
          raised: "#FAFAF7", // card / panel background
          line: "#E5E3DD",   // hairlines / dividers
          ink: "#F1EFEA",    // sunken panel
        },
        // Text on paper.
        ink: {
          DEFAULT: "#0A0908", // primary text (near-black)
          dim: "#4A4642",     // secondary
          mute: "#8A857E",    // tertiary / labels
        },
        // Primary UI accent — red. Used for highlights, buttons, links.
        accent: {
          DEFAULT: "#B2342A", // primary red
          deep: "#7A201A",    // hover / pressed
        },
        // IBJJF belt palette — preserved for rank chips so a blue belt
        // renders blue regardless of UI theme.
        belt: {
          white: "#ECE3CE",
          blue: "#2A55B8",
          purple: "#5B2D8A",
          brown: "#5E3A1F",
          black: "#0A0908",
          red: "#B2342A",
          stripe: "#F4F1E8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightish: "-0.015em",
        dojo: "0.08em",
      },
      boxShadow: {
        paper: "0 1px 0 0 rgba(10,9,8,0.04), 0 1px 2px 0 rgba(10,9,8,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
