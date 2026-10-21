"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { signIn, type ActionResult } from "@/lib/actions/auth";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => signIn(formData),
    {},
  );
  const [, startTransition] = useTransition();

  // Submitting through onSubmit (instead of `<form action>`) stops React 19 from resetting the form
  // after the action settles, so a failed sign-in doesn't wipe what the user typed.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={t.rich("footer", {
        link: (chunks) => (
          <Link href="/register" className="text-blue-400 hover:underline">{chunks}</Link>
        ),
      })}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-400">{state.error}</p>
        )}

        <Button type="submit" isLoading={isPending} className="mt-2 w-full">
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
