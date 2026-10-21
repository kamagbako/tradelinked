import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { Drift } from "@/components/motion/Ambient";
import { HoverLift, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

// Update this list to match the deposit options you actually support.
const METHODS = [
  { id: "bitcoin", name: "Bitcoin", glyph: "₿", color: "bg-orange-500" },
  { id: "usdt-trc20", name: "Tether TRC-20", glyph: "₮", color: "bg-teal-500" },
  { id: "usdt-bep20", name: "Tether BEP-20", glyph: "₮", color: "bg-emerald-500" },
  { id: "bnb", name: "BNB", glyph: "◆", color: "bg-yellow-500" },
  { id: "trx", name: "TRX", glyph: "T", color: "bg-red-500" },
  { id: "litecoin", name: "Litecoin", glyph: "Ł", color: "bg-slate-400" },
  { id: "bank", name: null, glyph: null, color: "bg-blue-500" },
] as const;

export function PaymentMethods() {
  const t = useTranslations("landing.payments");

  return (
    <section id="payments" className="scroll-mt-16 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 max-w-2xl text-text-muted">
            {t("subtitle")}
          </p>
        </Reveal>

        <Stagger stagger={0.14} className="mt-8 flex flex-wrap gap-3">
          {METHODS.map(({ id, name, glyph, color }, i) => (
            <StaggerItem key={id}>
              <Drift distance={5} duration={5 + (i % 3)} delay={i * 0.5}>
              <HoverLift className="glass-card flex items-center gap-3 rounded-full py-2 pl-2 pr-5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white ${color}`}
                aria-hidden="true"
              >
                {glyph ?? <Landmark className="h-4 w-4" />}
              </span>
              <span className="text-sm font-medium text-text">{name ?? t("bankTransfer")}</span>
              </HoverLift>
              </Drift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
