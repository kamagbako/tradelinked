"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { Globe, Mail, MapPin, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input, Label } from "@/components/ui/Input";
import { updateProfile, type ActionResult } from "@/lib/actions/account";
import { initialsOf } from "@/components/dashboard/nav";

export interface ProfileValues {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string;
  zipCode: string;
  city: string;
  address: string;
}

export function ProfileForm({ values }: { values: ProfileValues }) {
  const t = useTranslations("dashboard");
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => updateProfile(formData),
    {},
  );
  const [, startTransition] = useTransition();

  // Submit through onSubmit so React 19 doesn't reset the fields to their old values after an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const fullName = `${values.firstName} ${values.lastName}`.trim();
  const summary = [
    { icon: User, value: fullName },
    { icon: Mail, value: values.email },
    { icon: Phone, value: values.phone },
    { icon: Globe, value: values.country },
    { icon: MapPin, value: [values.city, values.state].filter(Boolean).join(", ") },
  ].filter((row) => row.value);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* Summary card */}
      <GlassCard className="p-5">
        <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-500 text-3xl font-bold text-white">
            {initialsOf(fullName, values.email)}
          </span>
        </div>
        <ul className="mt-5 flex flex-col gap-3">
          {summary.map(({ icon: Icon, value }) => (
            <li key={value} className="flex items-center gap-3 text-sm font-semibold text-text">
              <Icon className="h-4 w-4 flex-shrink-0 text-text-muted" />
              <span className="min-w-0 break-words">{value}</span>
            </li>
          ))}
        </ul>
      </GlassCard>

      {/* Edit form */}
      <GlassCard className="p-6 sm:p-8">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">{t("profile.firstName")} <span className="text-red-400">*</span></Label>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} autoComplete="given-name" required />
          </div>
          <div>
            <Label htmlFor="lastName">{t("profile.lastName")} <span className="text-red-400">*</span></Label>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} autoComplete="family-name" required />
          </div>
          <div>
            <Label htmlFor="phone">{t("profile.phone")}</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" />
          </div>
          <div>
            <Label htmlFor="country">{t("profile.country")}</Label>
            <Input id="country" name="country" defaultValue={values.country} autoComplete="country-name" />
          </div>
          <div>
            <Label htmlFor="state">{t("profile.state")}</Label>
            <Input id="state" name="state" defaultValue={values.state} autoComplete="address-level1" />
          </div>
          <div>
            <Label htmlFor="zipCode">{t("profile.zipCode")}</Label>
            <Input id="zipCode" name="zipCode" defaultValue={values.zipCode} autoComplete="postal-code" />
          </div>
          <div>
            <Label htmlFor="city">{t("profile.city")}</Label>
            <Input id="city" name="city" defaultValue={values.city} autoComplete="address-level2" />
          </div>
          <div>
            <Label htmlFor="email">{t("profile.email")}</Label>
            <Input id="email" value={values.email} readOnly disabled />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">{t("profile.address")}</Label>
            <Input id="address" name="address" defaultValue={values.address} autoComplete="street-address" />
          </div>

          <div className="sm:col-span-2">
            {state?.error && <p role="alert" className="mb-3 text-sm text-red-400">{state.error}</p>}
            {state?.success && <p className="mb-3 text-sm text-emerald-400">{t("profile.success")}</p>}
            <Button type="submit" isLoading={isPending} className="w-full">{t("profile.submit")}</Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
