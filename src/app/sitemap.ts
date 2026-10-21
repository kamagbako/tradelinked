import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";


export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
  ];
}
