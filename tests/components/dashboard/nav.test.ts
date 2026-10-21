import { describe, expect, it } from "vitest";
import { MOBILE_LABELS, MOBILE_PRIMARY, NAV_ITEMS, initialsOf, isActive } from "@/components/dashboard/nav";
import { loadMessages } from "@tests/helpers/messages";

describe("isActive", () => {
  it("matches /dashboard only exactly", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/deposit", "/dashboard")).toBe(false);
    expect(isActive("/dashboard/", "/dashboard")).toBe(false);
  });

  it("matches other hrefs exactly", () => {
    expect(isActive("/dashboard/deposit", "/dashboard/deposit")).toBe(true);
  });

  it("matches nested paths under an href", () => {
    expect(isActive("/dashboard/deposit/confirm", "/dashboard/deposit")).toBe(true);
  });

  it("does not match sibling paths sharing a prefix", () => {
    expect(isActive("/dashboard/depositors", "/dashboard/deposit")).toBe(false);
    expect(isActive("/dashboard/withdraw", "/dashboard/deposit")).toBe(false);
  });

  it("does not match a parent path against a child href", () => {
    expect(isActive("/dashboard", "/dashboard/deposit")).toBe(false);
  });
});

describe("initialsOf", () => {
  it("uses the first letters of the first two name parts, uppercased", () => {
    expect(initialsOf("ada lovelace", "a@b.com")).toBe("AL");
  });

  it("uses a single initial for a one-word name", () => {
    expect(initialsOf("Plato", "p@b.com")).toBe("P");
  });

  it("only uses the first two parts of long names", () => {
    expect(initialsOf("Mary Jane Watson", "m@b.com")).toBe("MJ");
  });

  it("trims and collapses whitespace", () => {
    expect(initialsOf("   Grace   Hopper  ", "g@b.com")).toBe("GH");
  });

  it("falls back to the email when the name is empty, blank, null or undefined", () => {
    expect(initialsOf("", "john.doe@example.com")).toBe("JD");
    expect(initialsOf("   ", "john.doe@example.com")).toBe("JD");
    expect(initialsOf(null, "john.doe@example.com")).toBe("JD");
    expect(initialsOf(undefined, "john.doe@example.com")).toBe("JD");
  });

  it("splits emails on @ . _ and -", () => {
    expect(initialsOf(null, "jane_roe@x.com")).toBe("JR");
    expect(initialsOf(null, "jane-roe@x.com")).toBe("JR");
    expect(initialsOf(null, "solo@example.com")).toBe("SE");
  });

  it("falls back to U when nothing usable remains", () => {
    expect(initialsOf(null, "")).toBe("U");
    expect(initialsOf(null, "@._-")).toBe("U");
  });
});

describe("NAV_ITEMS", () => {
  it("lists the nine dashboard destinations in order", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/dashboard",
      "/dashboard/plans",
      "/dashboard/deposit",
      "/dashboard/withdraw",
      "/dashboard/transactions",
      "/dashboard/messages",
      "/dashboard/2fa",
      "/dashboard/profile",
      "/dashboard/change-password",
    ]);
  });

  it("has unique keys and hrefs", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.key)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });

  it("gives every item a key, an absolute /dashboard href and an icon component", () => {
    for (const item of NAV_ITEMS) {
      expect(item.key).toBeTruthy();
      expect(item.href.startsWith("/dashboard")).toBe(true);
      expect(item.icon).toBeDefined();
    }
  });

  it("has an English label for every nav key", () => {
    const dashboard = loadMessages("en").dashboard as { nav: Record<string, string> };
    for (const item of NAV_ITEMS) expect(dashboard.nav[item.key], item.key).toBeTruthy();
  });
});

describe("mobile nav config", () => {
  it("MOBILE_PRIMARY is four hrefs that all exist in NAV_ITEMS", () => {
    expect(MOBILE_PRIMARY).toHaveLength(4);
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const href of MOBILE_PRIMARY) expect(hrefs).toContain(href);
  });

  it("MOBILE_LABELS has a label for exactly each primary href", () => {
    expect(Object.keys(MOBILE_LABELS).sort()).toEqual([...MOBILE_PRIMARY].sort());
  });

  it("MOBILE_LABELS values match the messages under mobileNav.tabs", () => {
    const dashboard = loadMessages("en").dashboard as { mobileNav?: { tabs?: Record<string, string> } };
    const tabs = dashboard.mobileNav?.tabs ?? {};
    for (const label of Object.values(MOBILE_LABELS)) expect(tabs).toHaveProperty(label);
  });
});
