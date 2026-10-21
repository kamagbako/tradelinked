import { describe, expect, it } from "vitest";
import { calculateDepositFee, isWithinDepositLimits, quoteDeposit, type DepositFeeSettings } from "@/lib/deposit-fees";

const NO_FEE: DepositFeeSettings = { feePercent: 0, feeFlat: 0, minUsd: 10, maxUsd: 1_000_000 };
const FLAT: DepositFeeSettings = { ...NO_FEE, feeFlat: 10 };
const PERCENT: DepositFeeSettings = { ...NO_FEE, feePercent: 10 };
const BOTH: DepositFeeSettings = { ...NO_FEE, feePercent: 10, feeFlat: 10 };

describe("calculateDepositFee", () => {
  it("is zero with no fee configured", () => {
    expect(calculateDepositFee(1000, NO_FEE)).toBe(0);
  });

  it("applies a flat fee regardless of amount", () => {
    expect(calculateDepositFee(1000, FLAT)).toBe(10);
    expect(calculateDepositFee(1, FLAT)).toBe(10);
  });

  it("applies a percentage of the amount", () => {
    expect(calculateDepositFee(1000, PERCENT)).toBe(100);
    expect(calculateDepositFee(50, PERCENT)).toBe(5);
  });

  it("combines a flat fee and a percentage", () => {
    expect(calculateDepositFee(1000, BOTH)).toBe(110);
  });

  it("rounds to the nearest cent", () => {
    expect(calculateDepositFee(33.33, { ...NO_FEE, feePercent: 10 })).toBe(3.33);
  });

  it("is zero for a non-positive or non-finite amount", () => {
    expect(calculateDepositFee(0, BOTH)).toBe(0);
    expect(calculateDepositFee(-5, BOTH)).toBe(0);
    expect(calculateDepositFee(NaN, BOTH)).toBe(0);
    expect(calculateDepositFee(Infinity, BOTH)).toBe(0);
  });

  it("is never negative even if a fee were misconfigured negative", () => {
    expect(calculateDepositFee(100, { ...NO_FEE, feeFlat: -50, feePercent: 0 })).toBe(0);
  });
});

describe("quoteDeposit", () => {
  it("returns amount, fee and total for a deposit with no fee", () => {
    expect(quoteDeposit(1000, NO_FEE)).toEqual({ amount: 1000, fee: 0, total: 1000 });
  });

  it("totals amount + fee for a combined flat and percentage fee", () => {
    expect(quoteDeposit(1000, BOTH)).toEqual({ amount: 1000, fee: 110, total: 1110 });
  });

  it("treats an empty or invalid amount as zero", () => {
    expect(quoteDeposit(NaN, BOTH)).toEqual({ amount: 0, fee: 0, total: 0 });
    expect(quoteDeposit(-10, BOTH)).toEqual({ amount: 0, fee: 0, total: 0 });
  });

  it("rounds the amount itself to the nearest cent", () => {
    expect(quoteDeposit(10.005, NO_FEE).amount).toBe(10.01);
  });
});

describe("isWithinDepositLimits", () => {
  const limits = { minUsd: 10, maxUsd: 1000 };

  it("accepts an amount strictly between the limits", () => {
    expect(isWithinDepositLimits(500, limits)).toBe(true);
  });

  it("accepts the boundary values themselves", () => {
    expect(isWithinDepositLimits(10, limits)).toBe(true);
    expect(isWithinDepositLimits(1000, limits)).toBe(true);
  });

  it("rejects just below the minimum or just above the maximum", () => {
    expect(isWithinDepositLimits(9.99, limits)).toBe(false);
    expect(isWithinDepositLimits(1000.01, limits)).toBe(false);
  });

  it("rejects NaN, negative and non-finite amounts", () => {
    expect(isWithinDepositLimits(NaN, limits)).toBe(false);
    expect(isWithinDepositLimits(-1, limits)).toBe(false);
    expect(isWithinDepositLimits(Infinity, limits)).toBe(false);
  });

  it("accepts anything when the max is Infinity", () => {
    expect(isWithinDepositLimits(10_000_000, { minUsd: 0, maxUsd: Infinity })).toBe(true);
  });
});
