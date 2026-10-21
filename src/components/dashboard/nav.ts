import {
  ArrowDownToLine,
  ArrowLeftRight,
  KeyRound,
  LayoutDashboard,
  Layers,
  MessageSquare,
  ShieldCheck,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

/** Every dashboard destination, in sidebar order. */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "plans", href: "/dashboard/plans", icon: Layers },
  { key: "deposit", href: "/dashboard/deposit", icon: Wallet },
  { key: "withdraw", href: "/dashboard/withdraw", icon: ArrowDownToLine },
  { key: "transactions", href: "/dashboard/transactions", icon: ArrowLeftRight },
  { key: "messages", href: "/dashboard/messages", icon: MessageSquare },
  { key: "twoFactor", href: "/dashboard/2fa", icon: ShieldCheck },
  { key: "profile", href: "/dashboard/profile", icon: User },
  { key: "changePassword", href: "/dashboard/change-password", icon: KeyRound },
];

/** The four most-used destinations that get a permanent slot in the mobile bar (plus "More"). */
export const MOBILE_PRIMARY = ["/dashboard", "/dashboard/deposit", "/dashboard/withdraw", "/dashboard/transactions"];

/** Translation keys (under `dashboard.mobileNav.tabs`) for the short tab labels, by href. */
export const MOBILE_LABELS: Record<string, string> = {
  "/dashboard": "home",
  "/dashboard/deposit": "deposit",
  "/dashboard/withdraw": "withdraw",
  "/dashboard/transactions": "history",
};

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function initialsOf(name: string | null | undefined, email: string) {
  const source = (name && name.trim()) || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}
