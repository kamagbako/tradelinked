"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { HoverLift, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Drift } from "@/components/motion/Ambient";
import { MobileDrawer } from "@/components/ui/MobileDrawer";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

export function PlansGrid() {
  const t = useTranslations("landing.plans");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const selectedName = selectedPlan ? t(`items.${selectedPlan}.name`) : "";

  return (
    <section id="plans" className="scroll-mt-16 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 text-text-muted">{t("subtitle")}</p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLANS.map((plan, i) => (
            <StaggerItem key={plan.id}>
            <Drift distance={6} duration={7 + i} delay={i * 1.1} className="h-full">
            <HoverLift className="h-full">
            <GlassCard
              className={cn(
                "flex h-full flex-col",
                plan.featured && "border-emerald-500/50 ring-1 ring-emerald-500/20",
              )}
            >
              {plan.featured && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  {t("mostPopular")}
                </span>
              )}
              <h3 className="text-lg font-semibold text-text">{t(`items.${plan.id}.name`)}</h3>
              <p className="mt-2 text-3xl font-bold text-emerald-500">
                {plan.roiPercent}%
                <span className="ml-1 text-sm font-normal text-text-muted">{t("perDays", { days: plan.durationDays })}</span>
              </p>
              <p className="mt-1 text-sm text-text-muted">
                ${plan.minDeposit.toLocaleString()} – ${plan.maxDeposit.toLocaleString()}
              </p>

              <ul className="mt-5 flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {t(`items.${plan.id}.features.${feature}`)}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full"
                variant={plan.featured ? "primary" : "secondary"}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {t("contactSupport")}
              </Button>
            </GlassCard>
            </HoverLift>
            </Drift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <MobileDrawer
        open={selectedPlan !== null}
        onClose={() => setSelectedPlan(null)}
        title={t("drawerTitle", { plan: selectedName })}
      >
        <p className="text-sm text-text-muted">
          {t.rich("drawerBody", {
            plan: (chunks) => <span className="text-text">{chunks}</span>,
            name: selectedName,
          })}
        </p>
        <a
          href={process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block"
        >
          <Button className="w-full">
            <MessageCircle className="h-5 w-5" />
            {t("chatWhatsApp")}
          </Button>
        </a>
      </MobileDrawer>
    </section>
  );
}
