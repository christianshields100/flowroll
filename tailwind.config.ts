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
        // Page surface — warm paper white ("The Quarterly").
        paper: {
          DEFAULT: "#FDFCFA",
          raised: "#FDFCFA", // flat: cards are hairline-bordered, not tinted
          line: "#E5E3DD",   // hairlines / dividers
          input: "#D8D5CE",  // input underlines
          sunken: "#F5F3EE", // coach bubbles, recessed panels
          ink: "#F1EFEA",    // deeper sunken panel
        },
        // Text on paper.
        ink: {
          DEFAULT: "#0A0908", // primary text + strong rules (near-black)
          dim: "#4A4642",     // secondary
          mute: "#8A857E",    // tertiary / labels
          faint: "#A6A199",   // lightest muted / dashed borders
        },
        // Primary UI accent — red. Used sparingly: one accent per view.
        accent: {
          DEFAULT: "#B2342A", // primary red
          deep: "#7A201A",    // hover / pressed
        },
        // Chart bars (inactive).
        bar: "#DEDCD5",
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
      // Single family everywhere; the three slots are kept so existing
      // font-display / font-mono call sites don't need touching.
      fontFamily: {
        display: ["var(--font-quarterly)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-quarterly)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-quarterly)", "ui-sans-serif", "system-ui"],
      },
      letterSpacing: {
        tightish: "-0.02em",
        dojo: "0.06em",
      },
      // No shadows in the Quarterly — hairlines do the separating.
      boxShadow: {
        paper: "none",
        lg: "none",
      },
      // Square corners everywhere (rounded-sm is used app-wide; zeroing it
      // squares the whole app in one move). rounded-full stays for
      // avatars, monograms, and the feel dots.
      borderRadius: {
        sm: "0",
      },
    },
  },
  plugins: [],
};
export default config;
