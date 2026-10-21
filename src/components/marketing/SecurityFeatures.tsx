import { useTranslations } from "next-intl";
import { Lock, ShieldCheck, Fingerprint, Activity } from "lucide-react";
import { HoverLift, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Drift } from "@/components/motion/Ambient";
import { GlassCard } from "@/components/ui/GlassCard";

const features = [
  {
    id: "encryption",
    icon: Lock,
  },
  {
    id: "custody",
    icon: ShieldCheck,
  },
  {
    id: "auth",
    icon: Fingerprint,
  },
  {
    id: "audit",
    icon: Activity,
  },
] as const;

export function SecurityFeatures() {
  const t = useTranslations("landing.security");

  return (
    <section id="security" className="scroll-mt-16 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 text-text-muted">{t("subtitle")}</p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ id, icon: Icon }, i) => (
            <StaggerItem key={id}>
            <Drift distance={5} duration={6 + i} delay={i * 0.9} className="h-full">
            <HoverLift className="h-full">
            <GlassCard className="h-full">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-text">{t(`features.${id}.title`)}</h3>
              <p className="mt-2 text-sm text-text-muted">{t(`features.${id}.description`)}</p>
            </GlassCard>
            </HoverLift>
            </Drift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
