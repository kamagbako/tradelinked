"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BookText, ArrowDownToLine, ArrowUpFromLine, Settings } from "lucide-react";
import { FloatingDock, type DockItem } from "react-floating-dock";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/ledger", label: "Ledger", icon: BookText },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowUpFromLine },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** The four most-used sections get a permanent slot in the mobile bar (plus "More"). */
const MOBILE_PRIMARY = ["/admin", "/admin/deposits", "/admin/withdrawals", "/admin/users"];
const primary = items.filter((item) => MOBILE_PRIMARY.includes(item.href));
const secondary = items.filter((item) => !MOBILE_PRIMARY.includes(item.href));

const primaryDockItems: DockItem[] = primary.map(({ href, label, icon }) => ({ key: href, href, label, icon }));
const secondaryDockItems: DockItem[] = secondary.map(({ href, label, icon }) => ({ key: href, href, label, icon }));

/** `/admin` only matches itself; other sections also match their nested routes (e.g. /admin/users/123). */
function isActiveRoute(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const theme = useTheme();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-border sm:block">
        <nav className="sticky top-16 flex flex-col gap-1 p-4">
          {items.map(({ href, label, icon: Icon }) => {
            const isActive = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-blue-500/10 text-blue-400" : "text-text-muted hover:bg-hover hover:text-text",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Floating, fully-rounded bottom bar in the style of the WhatsApp mobile menu, via
          react-floating-dock (https://www.npmjs.com/package/react-floating-dock) — the package
          this exact pattern, built for the user dashboard's MobileNav, was extracted into. */}
      <FloatingDock
        items={primaryDockItems}
        moreItems={secondaryDockItems}
        isActive={(href) => isActiveRoute(pathname, href)}
        LinkComponent={Link}
        theme={theme}
        className="sm:hidden"
        ariaLabel="Admin sections"
        moreSheetTitle="More sections"
      />
    </>
  );
}
