"use client";

import { useActionState, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { CopyRow } from "@/components/dashboard/CopyRow";
import { Input, Label } from "@/components/ui/Input";
import { submitDeposit, type ActionResult } from "@/lib/actions/deposits";
import { quoteDeposit, isWithinDepositLimits, type DepositFeeSettings } from "@/lib/deposit-fees";
import { formatCurrency } from "@/lib/utils";

export function DepositForm({
  btcAddress,
  qrDataUrl,
  feePercent,
  feeFlat,
  minUsd,
  maxUsd,
  initialAmount,
}: DepositFeeSettings & { btcAddress: string | null; qrDataUrl?: string | null; initialAmount?: number | null }) {
  const t = useTranslations("dashboard");
  const fees: DepositFeeSettings = useMemo(
    () => ({ feePercent, feeFlat, minUsd, maxUsd }),
    [feePercent, feeFlat, minUsd, maxUsd],
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Pre-filled when arriving with a specific plan in mind (its minimum deposit); the user can
  // still change it, this just saves them re-typing a number they already saw on the Plans page.
  const [amountInput, setAmountInput] = useState(initialAmount ? String(initialAmount) : "");

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(async (_prev, formData) => {
    const result = await submitDeposit(formData);
    if (result.success) {
      formRef.current?.reset();
      setAmountInput("");
    }
    return result;
  }, {});
  const [, startTransition] = useTransition();

  // Submit through onSubmit rather than `<form action>`: React 19 resets a form after its action settles,
  // which would wipe what the user typed on any server error. Success still clears the form explicitly.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const amount = Number(amountInput);
  const quote = useMemo(() => quoteDeposit(amount, fees), [amount, fees]);
  const touched = amountInput.trim() !== "";
  const withinLimits = touched && isWithinDepositLimits(amount, fees);
  const canSubmit = touched && withinLimits && !isPending;

  return (
    <GlassCard className="overflow-hidden">
      <h2 className="text-base font-semibold text-text">{t("deposit.form.title")}</h2>
      <p className="mb-4 mt-1 text-sm text-text-muted">{t("deposit.form.intro")}</p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
        {/* Left: where to send — address and QR code together, both always available. */}
        <div className="min-w-0">
          {btcAddress ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg p-4 text-center">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- small server-generated data URI, not worth next/image's overhead
                <img
                  src={qrDataUrl}
                  alt={t("deposit.form.qrAlt")}
                  width={192}
                  height={192}
                  className="h-40 w-40 flex-shrink-0 rounded-xl border border-border bg-white p-2 sm:h-44 sm:w-44"
                />
              )}
              <p className="text-xs text-text-muted">{t("deposit.form.qrCaption")}</p>
              <CopyRow label={t("deposit.details.btcAddress")} value={btcAddress} className="w-full min-w-0 bg-surface" />
            </div>
          ) : (
            <p className="h-full rounded-xl border border-amber-500/40 bg-surface p-3 text-sm text-text-muted">
              {t("deposit.notSetUp")}
            </p>
          )}
        </div>

        {/* Right: how much — amount, the fee/total breakdown, and confirm. */}
        <form ref={formRef} onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4">
          <div>
            <Label htmlFor="amount">{t("deposit.form.amount")}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-text-muted">$</span>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={fees.minUsd || undefined}
                max={fees.maxUsd || undefined}
                step="0.01"
                inputMode="decimal"
                required
                className="pl-7 text-right text-lg font-semibold"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-describedby="deposit-limit deposit-fee deposit-total"
              />
            </div>
            {touched && !withinLimits && (
              <p className="mt-1.5 text-xs text-red-400">
                {t("errors.depositOutsideLimits", { min: formatCurrency(fees.minUsd), max: formatCurrency(fees.maxUsd) })}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-3 text-sm">
            <div id="deposit-limit" className="flex items-center justify-between gap-2 text-text-muted">
              <span className="flex-shrink-0">{t("deposit.form.limit")}</span>
              <span className="truncate text-right text-text">
                {formatCurrency(fees.minUsd)} – {formatCurrency(fees.maxUsd)}
              </span>
            </div>
            <div id="deposit-fee" className="flex items-center justify-between gap-2 text-text-muted">
              <span className="inline-flex flex-shrink-0 items-center gap-1">
                {t("deposit.form.processingCharge")}
                <span title={t("deposit.form.processingChargeHint")}>
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
              <span className="truncate text-right text-text">{formatCurrency(quote.fee)}</span>
            </div>
            <div id="deposit-total" className="flex items-center justify-between gap-2 border-t border-border pt-2.5 font-semibold text-text">
              <span className="flex-shrink-0">{t("deposit.form.total")}</span>
              <span className="truncate text-right">{formatCurrency(quote.total)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="reference">{t("deposit.form.reference")}</Label>
            <Input id="reference" name="reference" placeholder={t("deposit.form.referencePlaceholder")} />
          </div>

          {state?.error && (
            <p role="alert" className="break-words text-sm text-red-400">
              {state.error}
            </p>
          )}
          {state?.success && <p className="break-words text-sm text-emerald-400">{t("deposit.form.success")}</p>}

          <Button type="submit" isLoading={isPending} disabled={!canSubmit} className="w-full">
            {t("deposit.form.submit")}
          </Button>
        </form>
      </div>
    </GlassCard>
  );
}
