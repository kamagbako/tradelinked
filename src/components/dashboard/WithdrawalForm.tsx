"use client";

import { useActionState, useRef, useTransition, type FormEvent } from "react";
import { ArrowDownToLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { submitWithdrawal, type ActionResult } from "@/lib/actions/withdrawals";

export function WithdrawalForm() {
  const t = useTranslations("dashboard");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      const result = await submitWithdrawal(formData);
      if (result.success) formRef.current?.reset();
      return result;
    },
    {},
  );

  const [, startTransition] = useTransition();

  // Submit through onSubmit rather than `<form action>`: React 19 resets a form after its action settles,
  // which would wipe what the user typed on any server error. Success still clears the form explicitly.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <GlassCard id="withdraw">
      <div className="mb-4 flex items-center gap-2">
        <ArrowDownToLine className="h-5 w-5 text-blue-400" />
        <h2 className="text-base font-semibold text-text">{t("withdraw.form.title")}</h2>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="amount">{t("withdraw.form.amount")}</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
        </div>

        <div>
          <Label htmlFor="payoutMethod">{t("withdraw.form.method")}</Label>
          <Select id="payoutMethod" name="payoutMethod" required defaultValue="">
            <option value="" disabled>{t("withdraw.form.selectMethod")}</option>
            <option value="BANK_TRANSFER">{t("methods.BANK_TRANSFER")}</option>
            <option value="BTC">{t("methods.BTC")}</option>
            <option value="USDT">{t("methods.USDT")}</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="payoutDetails">{t("withdraw.form.details")}</Label>
          <Textarea
            id="payoutDetails"
            name="payoutDetails"
            placeholder={t("withdraw.form.detailsPlaceholder")}
            required
          />
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-400">
            {t("withdraw.form.success")}
          </p>
        )}

        <Button type="submit" isLoading={isPending} className="w-full">
          {t("withdraw.form.submit")}
        </Button>
      </form>
    </GlassCard>
  );
}
