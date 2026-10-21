"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { HoverLift, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { activatePlan } from "@/lib/actions/plans";
import { PLANS } from "@/lib/plans";
import { cn, formatCurrency } from "@/lib/utils";

export function PlansPicker({
  activePlanId,
  availableBalance,
}: {
  activePlanId: string | null;
  availableBalance: number;
}) {
  const t = useTranslations("dashboard");
  const tItems = useTranslations("landing.plans.items");
  const [current, setCurrent] = useState(activePlanId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function activate(planId: string) {
    setError(null);
    setJustActivated(null);
    setPendingId(planId);
    startTransition(async () => {
      const result = await activatePlan(planId);
      if (result.error) setError(result.error);
      else {
        setCurrent(planId);
        setJustActivated(planId);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {justActivated && (
        <p className="text-sm text-emerald-400">{t("plans.success", { plan: tItems(`${justActivated}.name`) })}</p>
      )}

      <Stagger trigger="mount" className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current;
          const qualifies = availableBalance >= plan.minDeposit;

          return (
            <StaggerItem key={plan.id}>
              <HoverLift className="h-full">
                <GlassCard
                  className={cn(
                    "flex h-full flex-col",
                    plan.featured && !isCurrent && "border-emerald-500/50 ring-1 ring-emerald-500/20",
                    isCurrent && "border-blue-500/60 ring-1 ring-blue-500/20",
                  )}
                >
                  {isCurrent ? (
                    <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                      <Check className="h-3.5 w-3.5" />
                      {t("plans.current")}
                    </span>
                  ) : (
                    plan.featured && (
                      <span className="mb-3 inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        {t("plans.mostPopular")}
                      </span>
                    )
                  )}

                  <h3 className="text-lg font-semibold text-text">{tItems(`${plan.id}.name`)}</h3>
                  <p className="mt-2 text-3xl font-bold text-emerald-500">
                    {plan.roiPercent}%
                    <span className="ml-1 text-sm font-normal text-text-muted">
                      {t("plans.perDays", { days: plan.durationDays })}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatCurrency(plan.minDeposit)} – {formatCurrency(plan.maxDeposit)}
                  </p>

                  <ul className="mt-5 flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        {tItems(`${plan.id}.features.${feature}`)}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button variant="secondary" className="w-full" disabled>
                        {t("plans.currentButton")}
                      </Button>
                    ) : qualifies ? (
                      <Button
                        className="w-full"
                        variant={plan.featured ? "primary" : "secondary"}
                        isLoading={isPending && pendingId === plan.id}
                        disabled={isPending}
                        onClick={() => activate(plan.id)}
                      >
                        {current ? t("plans.switch") : t("plans.activate")}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                          {t("plans.locked", { amount: formatCurrency(plan.minDeposit) })}
                        </p>
                        <Link href={`/dashboard/deposit?plan=${plan.id}`}>
                          <Button variant="secondary" className="w-full">
                            {t("plans.depositCta")}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </HoverLift>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
