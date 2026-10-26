import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  const t = useTranslations("landing.footer");

  return (
    <footer id="contact" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <div className="mb-2">
              <Logo href="/" />
            </div>
            <p className="max-w-xs text-sm text-text-muted">
              {t("tagline")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-12">
            <div>
              <h3 className="mb-3 text-sm font-medium text-text">{t("company")}</h3>
              <ul className="flex flex-col gap-2 text-sm text-text-muted">
                <li><Link href="/#about" className="hover:text-text">{t("about")}</Link></li>
                <li><Link href="/#plans" className="hover:text-text">{t("investmentPlans")}</Link></li>
                <li><Link href="/#security" className="hover:text-text">{t("security")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-text">{t("legal")}</h3>
              <ul className="flex flex-col gap-2 text-sm text-text-muted">
                <li><Link href="/terms" className="hover:text-text">{t("terms")}</Link></li>
                <li><Link href="/privacy" className="hover:text-text">{t("privacy")}</Link></li>
                <li><Link href="/risk-disclosure" className="hover:text-text">{t("riskDisclosure")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-text">{t("account")}</h3>
              <ul className="flex flex-col gap-2 text-sm text-text-muted">
                <li><Link href="/login" className="hover:text-text">{t("logIn")}</Link></li>
                <li><Link href="/register" className="hover:text-text">{t("register")}</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-text-muted">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
