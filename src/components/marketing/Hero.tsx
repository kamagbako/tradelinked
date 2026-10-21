import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Drift, Orb, Parallax, ScrollFade } from "@/components/motion/Ambient";

const stats = [
  { id: "aum", value: "$48M+" },
  { id: "traders", value: "12,000+" },
  { id: "roi", value: "6.8%" },
] as const;

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
      <Parallax offset={90} className="pointer-events-none absolute -left-24 top-10 -z-10">
        <Orb duration={14} className="h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </Parallax>
      <Parallax offset={140} className="pointer-events-none absolute -right-24 top-32 -z-10">
        <Orb duration={17} delay={2} className="h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      </Parallax>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] opacity-40"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.25), transparent 70%)",
        }}
      />

      <ScrollFade>
      <Stagger trigger="mount" stagger={0.22} className="mx-auto max-w-4xl text-center">
        <StaggerItem>
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("badge")}
          </span>
        </StaggerItem>

        <StaggerItem>
          <h1 className="text-4xl font-bold leading-tight text-text sm:text-6xl">
            {t.rich("title", {
              grow: (chunks) => <span className="text-emerald-500">{chunks}</span>,
            })}
          </h1>
        </StaggerItem>

        <StaggerItem>
          <p className="mx-auto mt-5 max-w-2xl text-base text-text-muted sm:text-lg">
            {t("subtitle")}
          </p>
        </StaggerItem>

        <StaggerItem>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                <TrendingUp className="h-5 w-5" />
                {t("createAccount")}
              </Button>
            </Link>
            <a href="#plans" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                <Zap className="h-5 w-5" />
                {t("viewPlans")}
              </Button>
            </a>
          </div>
        </StaggerItem>

        <Stagger trigger="mount" stagger={0.2} className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <StaggerItem key={stat.id}>
              <Drift distance={7} duration={6 + i} delay={i * 0.8}>
                <div className="glass-card rounded-2xl p-5">
                  <p className="text-2xl font-bold text-text">{stat.value}</p>
                  <p className="mt-1 text-xs text-text-muted">{t(`stats.${stat.id}`)}</p>
                </div>
              </Drift>
            </StaggerItem>
          ))}
        </Stagger>
      </Stagger>
      </ScrollFade>
    </section>
  );
}
