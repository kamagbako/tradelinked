"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Globe, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Drift, Orb, Parallax } from "@/components/motion/Ambient";

const CHART_PATH =
  "M0 170 C 60 150, 90 190, 150 160 S 210 100, 240 118 S 320 60, 380 80 S 450 150, 500 110 S 570 60, 600 70";
// Marker sits on the path at (240, 118) of the 600x220 viewBox.
const MARKER = { left: `${(240 / 600) * 100}%`, top: `${(118 / 220) * 100}%` };

export function AboutSection() {
  const t = useTranslations("landing.about");

  return (
    <section id="about" className="relative scroll-mt-16 overflow-hidden px-4 py-20 sm:px-6">
      <Parallax offset={120} className="pointer-events-none absolute -right-32 top-1/3 -z-10">
        <Orb duration={16} className="h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </Parallax>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
          {/* Overlapping feature cards */}
          <div className="relative flex flex-col gap-4 lg:block lg:h-[440px]">
            <Reveal x={-70} y={0} className="lg:absolute lg:left-0 lg:top-0 lg:w-[88%]">
              <Drift distance={9} sway={4} duration={8}>
              <div className="glass-card rounded-3xl bg-gradient-to-br from-emerald-500/15 to-transparent p-6">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-emerald-500" />
                <h3 className="text-xl font-semibold text-text">{t("fastProgress.title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {t("fastProgress.body")}
              </p>
              </div>
              </Drift>
            </Reveal>

            <Reveal x={70} y={0} delay={0.3} className="lg:absolute lg:bottom-0 lg:right-0 lg:w-[88%]">
              <Drift distance={9} sway={-4} duration={9} delay={1.5}>
              <div className="glass-card rounded-3xl bg-gradient-to-br from-blue-500/15 to-transparent p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <Globe className="h-6 w-6 text-blue-500" />
                <h3 className="text-xl font-semibold text-text">{t("modernPlatform.title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {t("modernPlatform.body")}
              </p>
              <Link href="#plans" className="mt-5 inline-block">
                <Button variant="secondary" size="sm">{t("modernPlatform.explorePlans")}</Button>
              </Link>
              </div>
              </Drift>
            </Reveal>
          </div>

          {/* About copy */}
          <Reveal delay={0.15}>
            <h2 className="text-3xl font-bold text-text sm:text-4xl">
              {t.rich("heading", {
                brand: (chunks) => <span className="text-emerald-500">{chunks}</span>,
              })}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("whoWeAre")}</p>
            <p className="mt-6 text-xl font-medium leading-snug text-text sm:text-2xl">
              {t("lead")}
            </p>
            <p className="mt-5 text-sm leading-relaxed text-text-muted">
              {t("body")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {t("disclaimer")}
            </p>
          </Reveal>
        </div>

        {/* Performance visual + CTA */}
        <div className="mt-20 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Parallax offset={40}>
            <div className="glass-card relative rounded-3xl p-5 sm:p-6">
              <p className="mb-4 text-xs text-text-muted">{t("chartCaption")}</p>
              <div className="relative aspect-[600/220] w-full">
                <svg viewBox="0 0 600 220" className="h-full w-full overflow-visible" fill="none" aria-hidden="true">
                  <motion.path
                    d="M0 190 C 80 180, 140 150, 210 170 S 330 190, 400 140 S 520 150, 600 120"
                    stroke="currentColor"
                    className="text-text-muted/40"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                  />
                  <motion.path
                    d={CHART_PATH}
                    stroke="currentColor"
                    className="text-emerald-500"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 3.6, ease: "easeInOut" }}
                  />
                </svg>

                <div className="absolute" style={MARKER}>
                  <motion.span
                    className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-full bg-emerald-500"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 2.8, type: "spring", stiffness: 80, damping: 12 }}
                  />
                  <motion.span
                    className="absolute -left-3 -top-3 block h-6 w-6 rounded-full bg-emerald-500/40"
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute bottom-4 left-0 w-max -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 shadow-lg"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 3, duration: 1 }}
                  >
                    <p className="text-[10px] text-text-muted">{t("thisMonth")}</p>
                    <p className="text-base font-bold text-text">+$1,284.50</p>
                  </motion.div>
                </div>
              </div>
            </div>
            </Parallax>
          </Reveal>

          <Reveal delay={0.2}>
            <h2 className="text-3xl font-bold text-text sm:text-4xl">
              {t("anywhereHeading")}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {t("anywhereBody")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">{t("getStarted")}</Button>
              </Link>
              <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                <Smartphone className="h-5 w-5 text-blue-500" />
                {t("installable")}
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
