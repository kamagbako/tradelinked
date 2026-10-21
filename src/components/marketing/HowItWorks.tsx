import { useTranslations } from "next-intl";
import { ArrowDownToLine, LineChart, UserPlus, Wallet } from "lucide-react";
import { HoverLift, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Drift } from "@/components/motion/Ambient";
import { cn } from "@/lib/utils";

const steps = [
  {
    step: 1,
    id: "create",
    icon: UserPlus,
    tint: "from-emerald-500/20 text-emerald-500",
  },
  {
    step: 2,
    id: "fund",
    icon: Wallet,
    tint: "from-blue-500/20 text-blue-500",
  },
  {
    step: 3,
    id: "activate",
    icon: LineChart,
    tint: "from-amber-500/20 text-amber-500",
  },
  {
    step: 4,
    id: "withdraw",
    icon: ArrowDownToLine,
    tint: "from-violet-500/20 text-violet-500",
  },
] as const;

export function HowItWorks() {
  const t = useTranslations("landing.howItWorks");

  return (
    <section id="how-it-works" className="scroll-mt-16 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 text-text-muted">
            {t("subtitle")}
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {steps.map(({ step, id, icon: Icon, tint }) => (
            <StaggerItem key={step}>
              <Drift distance={6} duration={7 + step} delay={step * 0.7} className="h-full">
              <HoverLift
                className={cn(
                  "glass-card relative h-full overflow-hidden rounded-3xl bg-gradient-to-br to-transparent p-6 sm:p-8",
                  tint.split(" ")[0],
                )}
              >
                <span className="absolute right-6 top-4 select-none text-6xl font-bold text-text/5">
                  {step}
                </span>
                <Drift distance={4} duration={4 + step} className="w-fit">
                  <Icon className={cn("h-9 w-9", tint.split(" ")[1])} />
                </Drift>
                <h3 className="mt-5 text-xl font-semibold text-text">{t(`steps.${id}.title`)}</h3>
                <p className="mt-1 text-sm font-medium text-text">{t("stepLabel", { step })}</p>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{t(`steps.${id}.body`)}</p>
              </HoverLift>
              </Drift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
