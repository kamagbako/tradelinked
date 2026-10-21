import type { InvestmentPlan } from "@/lib/types";

/**
 * Canonical plan catalogue, shared by the public landing page and the signed-in "Plans" page
 * (`/dashboard/plans`) so the two never drift apart. `id` is also stored verbatim in
 * `profiles.active_plan` once a user activates a plan.
 */
export const PLANS: InvestmentPlan[] = [
  {
    id: "starter",
    minDeposit: 500,
    maxDeposit: 4999,
    roiPercent: 4.5,
    durationDays: 30,
    features: ["ticker", "email", "ledger"],
  },
  {
    id: "growth",
    minDeposit: 5000,
    maxDeposit: 24999,
    roiPercent: 6.8,
    durationDays: 30,
    features: ["withdrawal", "whatsapp", "note"],
    featured: true,
  },
  {
    id: "elite",
    minDeposit: 25000,
    maxDeposit: 250000,
    roiPercent: 9.2,
    durationDays: 30,
    features: ["manager", "payout", "priority"],
  },
];

export function getPlan(id: string): InvestmentPlan | undefined {
  return PLANS.find((plan) => plan.id === id);
}
