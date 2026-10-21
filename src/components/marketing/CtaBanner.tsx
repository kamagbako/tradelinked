import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Orb } from "@/components/motion/Ambient";

export function CtaBanner() {
  const t = useTranslations("landing.cta");

  return (
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <Reveal className="glass-card relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/15 via-transparent to-blue-500/15 p-8 text-center sm:p-14">
        <Orb duration={11} className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <Orb duration={13} delay={2} className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <h2 className="relative text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-text-muted">
          {t("body")}
        </p>
        <Link href="/register" className="relative mt-8 inline-block">
          <Button size="lg">{t("button")}</Button>
        </Link>
      </Reveal>
    </section>
  );
}
