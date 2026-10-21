/** Rounds to the nearest cent, avoiding floating-point artifacts like 109.99999999999999. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface DepositFeeSettings {
  /** Percentage of the deposit amount, e.g. 2.5 for 2.5%. */
  feePercent: number;
  /** Flat charge in USD, added on top of the percentage. */
  feeFlat: number;
  minUsd: number;
  maxUsd: number;
}

export interface DepositQuote {
  amount: number;
  fee: number;
  /** What the user should actually send: amount + fee. */
  total: number;
}

/** The processing fee for a given deposit amount: a flat charge plus a percentage of the amount. */
export function calculateDepositFee(amount: number, settings: DepositFeeSettings): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const percentPart = (settings.feePercent / 100) * amount;
  return Math.max(0, toCents(percentPart + settings.feeFlat));
}

/** Amount, fee and total to send, all rounded to the nearest cent. */
export function quoteDeposit(amount: number, settings: DepositFeeSettings): DepositQuote {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? toCents(amount) : 0;
  const fee = calculateDepositFee(safeAmount, settings);
  return { amount: safeAmount, fee, total: toCents(safeAmount + fee) };
}

export function isWithinDepositLimits(amount: number, settings: Pick<DepositFeeSettings, "minUsd" | "maxUsd">): boolean {
  return Number.isFinite(amount) && amount >= settings.minUsd && amount <= settings.maxUsd;
}
