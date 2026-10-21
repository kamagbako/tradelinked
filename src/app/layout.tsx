import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getSiteUrl } from "@/lib/env";
import { themeInitScript } from "@/lib/theme-script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: "%s | TradeLinked",
    },
    description: t("description"),
    keywords: ["trading platform", "investment portal", "portfolio management", "TradeLinked"],
    openGraph: {
      title: t("title"),
      description: t("ogDescription"),
      url: siteUrl,
      siteName: "TradeLinked",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("twitterDescription"),
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/icons/icon-192.png",
      apple: "/icons/icon-192.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c14",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("landing.meta");
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: "TradeLinked",
    url: siteUrl,
    description: t("description"),
    areaServed: "Worldwide",
  };

  return (
    <html lang={locale} className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
           
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <MotionProvider>{children}</MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
