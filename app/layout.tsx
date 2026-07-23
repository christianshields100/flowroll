import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

// "The Quarterly" uses a single family everywhere — Instrument Sans fills
// all three legacy font slots (display / body / mono) so every existing
// font-* class resolves to it. Tabular numerals come from font-variant
// (see .num in globals.css), not a mono face.
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-quarterly",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlowRoll — BJJ training log",
  description: "A disciplined training log for jiu-jitsu.",
  appleWebApp: {
    capable: true,
    title: "FlowRoll",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDFCFA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={instrument.variable}>
      <body className="text-ink antialiased">{children}</body>
    </html>
  );
}
