"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Circle } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { signUp, type ActionResult } from "@/lib/actions/auth";
import { PASSWORD_MIN_LENGTH, isValidEmail, passwordChecks } from "@/lib/validation";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => signUp(formData),
    {},
  );

  const [, startTransition] = useTransition();

  // Submit via onSubmit rather than `<form action>`: React 19 resets a form after its action settles,
  // which would uncheck the (controlled) terms checkbox and desync it from state after a failed attempt.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const checks = passwordChecks(password);
  const passwordValid = checks.every((check) => check.met);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch;

  const canSubmit =
    fullName.trim().length > 0 && isValidEmail(email) && passwordValid && passwordsMatch && acceptedTerms;

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={t.rich("footer", {
        link: (chunks) => (
          <Link href="/login" className="text-blue-400 hover:underline">{chunks}</Link>
        ),
      })}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-requirements"
            required
          />
          <ul id="password-requirements" className="mt-2 flex flex-col gap-1">
            {checks.map((check) => (
              <li
                key={check.id}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  check.met ? "text-emerald-400" : "text-text-muted",
                )}
              >
                {check.met ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {tCommon(`passwordRules.${check.id}`, { min: PASSWORD_MIN_LENGTH })}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={showMismatch}
            aria-describedby="confirm-status"
            required
          />
          <p
            id="confirm-status"
            aria-live="polite"
            className={cn("mt-1.5 min-h-4 text-xs", showMismatch ? "text-red-400" : "text-emerald-400")}
          >
            {showMismatch ? t("passwordsMismatch") : passwordsMatch ? t("passwordsMatch") : ""}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-text-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-blue-500"
            required
          />
          <span>
            {t.rich("terms", {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" className="text-blue-400 hover:underline">{chunks}</Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" className="text-blue-400 hover:underline">{chunks}</Link>
              ),
              risk: (chunks) => (
                <Link href="/risk-disclosure" target="_blank" className="text-blue-400 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        {state?.error && (
          <p role="alert" className="text-sm text-red-400">{state.error}</p>
        )}

        <Button type="submit" isLoading={isPending} disabled={!canSubmit} className="mt-2 w-full">
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
