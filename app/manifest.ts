import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlowRoll — BJJ training log",
    short_name: "FlowRoll",
    description: "A disciplined training log for jiu-jitsu.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#FAFAF7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
