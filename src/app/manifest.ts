import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeLinked",
    short_name: "TradeLinked",
    description: "Trade smarter. Grow your portfolio with confidence.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#080c14",
    theme_color: "#080c14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
