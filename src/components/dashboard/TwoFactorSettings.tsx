"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input, Label } from "@/components/ui/Input";
import { CopyRow } from "@/components/dashboard/CopyRow";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";

type Phase = "loading" | "off" | "enrolling" | "on";

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function TwoFactorSettings() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [phase, setPhase] = useState<Phase>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.[0] ?? null;
      setFactorId(verified?.id ?? null);
      setPhase(verified ? "on" : "off");
    } catch (e) {
      // Don't leave the page stuck on "loading" if the auth service can't be reached.
      logError("2fa.refresh", e);
      setError(tCommon("errors.unexpected"));
      setPhase("off");
    }
  }, [tCommon]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnrollment() {
    try {
      setBusy(true);
      setError(null);
      const supabase = createClient();

      // Clear out half-finished setups so a fresh QR code can be issued.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `TradeLinked ${Date.now()}`,
      });
      setBusy(false);

      if (enrollError || !data) {
        setError(enrollError?.message ?? t("twoFactor.errors.startFailed"));
        return;
      }
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setPhase("enrolling");
    } catch (e) {
      logError("2fa.startEnrollment", e);
      setError(tCommon("errors.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollment) return;
    try {
      setBusy(true);
      setError(null);
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: code.trim(),
      });
      setBusy(false);

      if (verifyError) {
        setError(t("twoFactor.errors.badCode"));
        return;
      }
      setEnrollment(null);
      setCode("");
      await refresh();
    } catch (e) {
      logError("2fa.verifyEnrollment", e);
      setError(tCommon("errors.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!factorId) return;
    try {
      setBusy(true);
      setError(null);
      const supabase = createClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      setBusy(false);
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      await refresh();
    } catch (e) {
      logError("2fa.disable", e);
      setError(tCommon("errors.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    try {
      if (enrollment) await createClient().auth.mfa.unenroll({ factorId: enrollment.factorId });
    } catch (e) {
      logError("2fa.cancelEnrollment", e);
    }
    setEnrollment(null);
    setCode("");
    setError(null);
    setPhase("off");
  }

  if (phase === "loading") {
    return <GlassCard className="max-w-xl text-sm text-text-muted">{t("twoFactor.loading")}</GlassCard>;
  }

  return (
    <GlassCard className="max-w-xl">
      {phase === "on" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-text">{t("twoFactor.onTitle")}</p>
              <p className="text-sm text-text-muted">{t("twoFactor.onBody")}</p>
            </div>
          </div>
          <Button variant="danger" onClick={disable} isLoading={busy} className="w-fit">
            <ShieldOff className="h-4 w-4" />
            {t("twoFactor.turnOff")}
          </Button>
        </div>
      )}

      {phase === "off" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-semibold text-text">{t("twoFactor.offTitle")}</p>
            <p className="mt-1 text-sm text-text-muted">
              {t("twoFactor.offBody")}
            </p>
          </div>
          <Button onClick={startEnrollment} isLoading={busy} className="w-fit">{t("twoFactor.setUp")}</Button>
        </div>
      )}

      {phase === "enrolling" && enrollment && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text">1.</span> {t("twoFactor.scanStep")}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt={t("twoFactor.qrAlt")} className="h-44 w-44 rounded-xl bg-white p-2" />
          <CopyRow label={t("twoFactor.manualKey")} value={enrollment.secret} />
          <div>
            <Label htmlFor="totp">
              <span className="font-semibold text-text">2.</span> {t("twoFactor.codeStep")}
            </Label>
            <Input
              id="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t("twoFactor.codePlaceholder")}
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={verifyEnrollment} isLoading={busy} disabled={code.length !== 6}>{t("twoFactor.verify")}</Button>
            <Button variant="ghost" onClick={cancelEnrollment} disabled={busy}>{t("twoFactor.cancel")}</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
    </GlassCard>
  );
}
