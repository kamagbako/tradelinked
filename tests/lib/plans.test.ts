import { describe, expect, it } from "vitest";
import { PLANS, getPlan } from "@/lib/plans";
import { loadMessages } from "@tests/helpers/messages";

describe("PLANS", () => {
  it("has a unique id for every plan", () => {
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
  });

  it("orders deposit ranges from lowest to highest with no overlap", () => {
    const sorted = [...PLANS].sort((a, b) => a.minDeposit - b.minDeposit);
    expect(PLANS).toEqual(sorted);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].minDeposit).toBeGreaterThan(sorted[i - 1].maxDeposit);
    }
  });

  it("gives every plan a positive deposit range, ROI and duration", () => {
    for (const plan of PLANS) {
      expect(plan.maxDeposit).toBeGreaterThan(plan.minDeposit);
      expect(plan.roiPercent).toBeGreaterThan(0);
      expect(plan.durationDays).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it("marks exactly one plan as featured", () => {
    expect(PLANS.filter((p) => p.featured).length).toBe(1);
  });

  it("has an English translation (name + every feature) for every plan", () => {
    const items = loadMessages("en").landing as {
      plans: { items: Record<string, { name: string; features: Record<string, string> }> };
    };
    for (const plan of PLANS) {
      const entry = items.plans.items[plan.id];
      expect(entry, plan.id).toBeDefined();
      expect(entry.name).toBeTruthy();
      for (const feature of plan.features) expect(entry.features[feature], `${plan.id}.${feature}`).toBeTruthy();
    }
  });
});

describe("getPlan", () => {
  it("finds a plan by id", () => {
    expect(getPlan("growth")?.minDeposit).toBe(5000);
  });

  it("returns undefined for an unknown id", () => {
    expect(getPlan("vip-platinum")).toBeUndefined();
  });

  it("is case-sensitive (ids are lowercase)", () => {
    expect(getPlan("Growth")).toBeUndefined();
  });
});
