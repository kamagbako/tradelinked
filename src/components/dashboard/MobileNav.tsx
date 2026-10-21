"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { FloatingDock, type DockItem } from "react-floating-dock";
import { LanguagePills } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { signOut } from "@/lib/actions/auth";
import { useTheme } from "@/lib/theme";
import { MOBILE_LABELS, MOBILE_PRIMARY, NAV_ITEMS, isActive } from "@/components/dashboard/nav";

const primary = NAV_ITEMS.filter((item) => MOBILE_PRIMARY.includes(item.href));
const secondary = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.href));

/**
 * Floating, fully-rounded bottom bar in the style of the WhatsApp mobile menu — now built on
 * react-floating-dock (https://www.npmjs.com/package/react-floating-dock), the package this
 * exact pattern was extracted into. A sliding pill marks the active tab, and "More" opens the
 * remaining destinations as round buttons.
 */
export function MobileNav({ isAdmin = false, unreadMessages = 0 }: { isAdmin?: boolean; unreadMessages?: number }) {
  const pathname = usePathname();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const theme = useTheme();

  const items: DockItem[] = primary.map(({ href, icon }) => ({
    key: href,
    href,
    icon,
    label: t(`mobileNav.tabs.${MOBILE_LABELS[href]}`),
  }));

  const moreItems: DockItem[] = secondary.map(({ key, href, icon }) => ({
    key: href,
    href,
    icon,
    label: t(`nav.${key}`),
    badge: href === "/dashboard/messages" ? (unreadMessages > 9 ? "9+" : unreadMessages) : undefined,
  }));

  return (
    <FloatingDock
      items={items}
      moreItems={moreItems}
      isActive={(href) => isActive(pathname, href)}
      LinkComponent={Link}
      theme={theme}
      className="lg:hidden"
      ariaLabel={t("mobileNav.main")}
      moreLabel={t("mobileNav.more")}
      moreSheetTitle={t("mobileNav.menu")}
      closeLabel={tCommon("close")}
      extraContent={
        <>
          <div className="rfd-more-grid" style={{ marginTop: "1rem" }}>
            {isAdmin && (
              <Link href="/admin" className="rfd-more-item">
                <span className="rfd-more-icon-circle" style={{ background: "rgb(245 158 11 / 0.1)", color: "#f59e0b" }}>
                  <ShieldCheck className="rfd-more-icon" />
                </span>
                <span className="rfd-more-label">{t("mobileNav.admin")}</span>
              </Link>
            )}

            <div className="rfd-more-item">
              <ThemeToggle className="h-16 w-16 bg-hover text-text [&_svg]:h-6 [&_svg]:w-6" />
              <span className="rfd-more-label">{t("mobileNav.theme")}</span>
            </div>

            <form action={signOut} className="rfd-more-item">
              <button
                type="submit"
                className="rfd-more-icon-circle"
                style={{ background: "rgb(248 113 113 / 0.1)", color: "#f87171", border: "none", cursor: "pointer" }}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rfd-more-icon" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
              <span className="rfd-more-label">{t("mobileNav.logOut")}</span>
            </form>
          </div>

          <div className="mt-4 border-t border-border pt-4 sm:hidden">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("mobileNav.language")}</p>
            <LanguagePills />
          </div>
        </>
      }
    />
  );
}
