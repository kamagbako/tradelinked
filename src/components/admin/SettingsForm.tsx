"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { updateCompanySettings, type ActionResult } from "@/lib/actions/settings";
import type { CompanySettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: CompanySettings | null }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => updateCompanySettings(formData),
    {},
  );
  const [, startTransition] = useTransition();

  // Submit through onSubmit so React 19 doesn't reset the fields after an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <GlassCard className="max-w-2xl">
      <h2 className="mb-4 text-base font-semibold text-text">Company Payout Details</h2>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Bitcoin deposits</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Deposits currently only accept Bitcoin. The fee and limits below are shown to users on the Deposit page
              and apply only to Bitcoin.
            </p>
          </div>

          <div>
            <Label htmlFor="btcAddress">BTC receiving address</Label>
            <Input id="btcAddress" name="btcAddress" defaultValue={settings?.btc_address ?? ""} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="depositFeePercent">Processing fee (%)</Label>
              <Input
                id="depositFeePercent"
                name="depositFeePercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={settings?.deposit_fee_percent ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="depositFeeFlat">Processing fee, flat ($)</Label>
              <Input
                id="depositFeeFlat"
                name="depositFeeFlat"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings?.deposit_fee_flat ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="depositMinUsd">Minimum deposit ($)</Label>
              <Input
                id="depositMinUsd"
                name="depositMinUsd"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings?.deposit_min_usd ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="depositMaxUsd">Maximum deposit ($)</Label>
              <Input
                id="depositMaxUsd"
                name="depositMaxUsd"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings?.deposit_max_usd ?? ""}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <div>
            <h3 className="text-sm font-semibold text-text">Low balance alerts</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              When a user&apos;s available balance drops below this amount, they get a one-time email nudge to deposit.
              Leave at 0 to turn this off.
            </p>
          </div>

          <div>
            <Label htmlFor="lowBalanceThresholdUsd">Alert threshold ($)</Label>
            <Input
              id="lowBalanceThresholdUsd"
              name="lowBalanceThresholdUsd"
              type="number"
              min="0"
              step="0.01"
              defaultValue={settings?.low_balance_threshold_usd ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <div>
            <h3 className="text-sm font-semibold text-text">Bank &amp; USDT details</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Not currently used — the Deposit page only shows Bitcoin. Kept here in case you re-enable these methods.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" name="bankName" defaultValue={settings?.bank_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="bankAccountName">Account name</Label>
              <Input id="bankAccountName" name="bankAccountName" defaultValue={settings?.bank_account_name ?? ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={settings?.bank_account_number ?? ""} />
          </div>

          <div>
            <Label htmlFor="usdtAddress">USDT (TRC20) address</Label>
            <Input id="usdtAddress" name="usdtAddress" defaultValue={settings?.usdt_address ?? ""} />
          </div>
        </div>

        <div>
          <Label htmlFor="whatsappSupportUrl">WhatsApp support link</Label>
          <Input
            id="whatsappSupportUrl"
            name="whatsappSupportUrl"
            type="url"
            placeholder="https://wa.me/10000000000"
            defaultValue={settings?.whatsapp_support_url ?? ""}
          />
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-400">Settings saved.</p>}

        <Button type="submit" isLoading={isPending} className="w-full sm:w-auto">
          Save Settings
        </Button>
      </form>
    </GlassCard>
  );
}
