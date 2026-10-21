"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { changePassword, type ActionResult } from "@/lib/actions/account";
import { PASSWORD_MIN_LENGTH, passwordChecks } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function ChangePasswordForm() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(async (_prev, formData) => {
    const result = await changePassword(formData);
    if (result.success) {
      formRef.current?.reset();
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    return result;
  }, {});

  const checks = passwordChecks(next);
  const matches = confirm.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && checks.every((c) => c.met) && matches;

  return (
    <GlassCard className="max-w-xl">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="currentPassword">{t("changePassword.current")}</Label>
          <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="newPassword">{t("changePassword.new")}</Label>
          <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <ul className="mt-2 flex flex-col gap-1">
            {checks.map((c) => (
              <li key={c.id} className={cn("flex items-center gap-2 text-xs", c.met ? "text-emerald-400" : "text-text-muted")}>
                {c.met ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {tCommon(`passwordRules.${c.id}`, { min: PASSWORD_MIN_LENGTH })}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t("changePassword.confirm")}</Label>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <p aria-live="polite" className={cn("mt-1.5 min-h-4 text-xs", confirm && !matches ? "text-red-400" : "text-emerald-400")}>
            {confirm ? (matches ? t("changePassword.match") : t("changePassword.mismatch")) : ""}
          </p>
        </div>

        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-400">{t("changePassword.success")}</p>}

        <Button type="submit" isLoading={isPending} disabled={!canSubmit} className="w-fit">{t("changePassword.submit")}</Button>
      </form>
    </GlassCard>
  );
}
