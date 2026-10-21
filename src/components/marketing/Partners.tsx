import { useTranslations } from "next-intl";
import { Reveal } from "@/components/motion/Reveal";
import { Marquee } from "@/components/motion/Ambient";
import { PARTNER_MARKS } from "@/components/marketing/partnerMarks";

// Only keep organisations you actually have a relationship with.
// `logoSrc` (e.g. "/partners/binance.svg") overrides the built-in mark with an official logo file.
const PARTNERS: { name: string; mark: keyof typeof PARTNER_MARKS; className: string; logoSrc?: string }[] = [
  { name: "BINANCE", mark: "binance", className: "font-extrabold tracking-[0.2em]" },
  { name: "Authereum", mark: "authereum", className: "font-semibold" },
  { name: "Fortmatic", mark: "fortmatic", className: "font-bold" },
  { name: "AIRSWAP", mark: "airswap", className: "font-medium tracking-[0.12em]" },
  { name: "Blockchain.com", mark: "blockchain", className: "font-semibold tracking-tight" },
  { name: "crypto.com", mark: "cryptocom", className: "font-semibold" },
];

function PartnerLogo({
  name,
  mark,
  className,
  logoSrc,
  hidden,
}: (typeof PARTNERS)[number] & { hidden?: boolean }) {
  const { color, path, evenodd } = PARTNER_MARKS[mark];

  return (
    <span className="flex items-center gap-3 whitespace-nowrap px-8 sm:px-12" aria-hidden={hidden || undefined}>
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-9 w-9 object-contain" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-9 w-9 flex-shrink-0" aria-hidden="true">
          <path d={path} fill={color} fillRule={evenodd ? "evenodd" : undefined} />
        </svg>
      )}
      <span className={`text-2xl text-text sm:text-3xl ${className}`}>{name}</span>
    </span>
  );
}

export function Partners() {
  const t = useTranslations("landing.partners");
  // Repeated so the loop stays seamless even on very wide screens.
  const items = [...PARTNERS, ...PARTNERS];

  return (
    <section id="partners" className="scroll-mt-16 overflow-hidden px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-3xl font-bold text-text sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 max-w-2xl text-text-muted">
            {t("subtitle")}
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.2} className="mt-12">
        <Marquee duration={60} className="mx-auto max-w-7xl">
          {items.map((partner, i) => (
            <PartnerLogo key={`${partner.name}-${i}`} {...partner} hidden={i >= PARTNERS.length} />
          ))}
        </Marquee>
      </Reveal>
    </section>
  );
}
