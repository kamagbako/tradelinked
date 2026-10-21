"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { postLoginDestination } from "@/lib/auth/destination";
import { logError } from "@/lib/logger";

export default function MfaChallengePage() {
  const t = useTranslations("auth.mfa");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let client: ReturnType<typeof createClient>;
    try {
      client = createClient();
    } catch (e) {
      // Misconfigured Supabase env: explain instead of crashing the page.
      logError("mfa.createClient", e);
      setError(tCommon("errors.unexpected"));
      return;
    }
    client.auth.mfa
      .listFactors()
      .then(({ data }) => {
        const factor = data?.totp?.[0];
        if (factor) setFactorId(factor.id);
        else router.replace("/dashboard");
      })
      .catch((e) => {
        logError("mfa.listFactors", e);
        setError(tCommon("errors.unexpected"));
      });
  }, [router, tCommon]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const client = createClient();
      const { data: verifyData, error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (verifyError) {
        setBusy(false);
        setError(t("invalidCode"));
        return;
      }
      const { data: profile } = await client.from("profiles").select("role").eq("id", verifyData.user.id).single();
      router.replace(postLoginDestination(profile?.role));
      router.refresh();
    } catch (e) {
      logError("mfa.verify", e);
      setBusy(false);
      setError(tCommon("errors.unexpected"));
    }
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <form action={signOut} className="inline">
          <button type="submit" className="text-blue-400 hover:underline">{t("useDifferentAccount")}</button>
        </form>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="code">{t("codeLabel")}</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder={t("codePlaceholder")}
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" isLoading={busy} disabled={code.length !== 6 || !factorId} className="w-full">
          {t("verify")}
        </Button>
      </form>
    </AuthCard>
  );
}
