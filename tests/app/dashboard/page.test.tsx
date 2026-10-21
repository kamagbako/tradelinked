import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import DashboardPage, { generateMetadata } from "@/app/dashboard/page";
import { requireUser } from "@/lib/auth/guard";
import { loadMessages } from "@tests/helpers/messages";
import { RedirectSignal, createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const locale = vi.hoisted(() => ({ current: "en" }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { loadMessages } = await import("@tests/helpers/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: locale.current, messages: loadMessages(locale.current), namespace: namespace as never }),
  };
});
vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/components/layout/InstallPrompt", () => ({ InstallPrompt: () => <div data-testid="install-prompt" /> }));
vi.mock("@/components/dashboard/TradingViewTicker", () => ({ TradingViewTicker: () => <div data-testid="ticker" /> }));
vi.mock("@/components/dashboard/TradingViewScreener", () => ({ TradingViewScreener: () => <div data-testid="screener" /> }));

beforeEach(() => {
  locale.current = "en";
});

type Row = Record<string, unknown>;

async function renderPage(
  data: {
    profile?: Row | null;
    balance?: Row | null;
    deposits?: Row[] | null;
    withdrawals?: Row[] | null;
    totp?: { id: string }[];
  } = {},
) {
  const options: SupabaseMockOptions = {
    tables: {
      profiles: { data: data.profile === undefined ? { active_plan: null } : data.profile },
      balances: { data: data.balance === undefined ? null : data.balance },
      deposits: { data: data.deposits === undefined ? [] : data.deposits },
      withdrawals: { data: data.withdrawals === undefined ? [] : data.withdrawals },
    },
    factors: { totp: data.totp ?? [] },
  };
  const mock = createSupabaseMock(options);
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await DashboardPage();
  const lang = locale.current;
  render(
    <NextIntlClientProvider locale={lang} messages={loadMessages(lang)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

const card = (title: string) => screen.getByRole("heading", { name: title }).closest(".glass-card") as HTMLElement;

const dep = (amount: number | string, status: string) => ({ amount, status });

describe("dashboard home page", () => {
  it("sets the page title from the nav translation", async () => {
    expect(await generateMetadata()).toEqual({ title: "Dashboard" });
  });

  it("propagates the redirect when the user is not signed in", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(DashboardPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  describe("layout", () => {
    it("renders the install prompt, ticker and market screener", async () => {
      await renderPage();
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
      expect(screen.getByTestId("ticker")).toBeInTheDocument();
      expect(screen.getByTestId("screener")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Crypto Market Stats" })).toBeInTheDocument();
    });

    it("renders the three stat cards", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: "Successful Deposits" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Successful Withdrawals" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Total Earnings" })).toBeInTheDocument();
    });

    it("queries only the signed-in user's rows", async () => {
      const { builders } = await renderPage();
      for (const table of ["profiles", "balances", "deposits", "withdrawals"]) {
        expect(builders[table].calls).toContainEqual({ method: "eq", args: [table === "profiles" ? "id" : "user_id", "user-1"] });
      }
    });
  });

  describe("deposits card", () => {
    const deposits = [
      dep(100, "APPROVED"),
      dep("50.5", "APPROVED"),
      dep(30, "PENDING"),
      dep(20, "REJECTED"),
    ];

    it("headlines the approved total", async () => {
      await renderPage({ deposits });
      expect(within(card("Successful Deposits")).getByText("$150.50 USD")).toBeInTheDocument();
    });

    it("shows submitted, pending and rejected sums in the columns", async () => {
      await renderPage({ deposits });
      const c = within(card("Successful Deposits"));
      expect(c.getByText("Submitted").nextElementSibling).toHaveTextContent("$200.50 USD");
      expect(c.getByText("Pending").nextElementSibling).toHaveTextContent("$30.00 USD");
      expect(c.getByText("Rejected").nextElementSibling).toHaveTextContent("$20.00 USD");
    });

    it("summarises the counts in the footer", async () => {
      await renderPage({ deposits });
      expect(
        within(card("Successful Deposits")).getByText("You've submitted 4 deposits: 2 approved, 1 pending and 1 rejected."),
      ).toBeInTheDocument();
    });

    it("uses the singular for exactly one deposit", async () => {
      await renderPage({ deposits: [dep(10, "PENDING")] });
      expect(
        within(card("Successful Deposits")).getByText("You've submitted 1 deposit: 0 approved, 1 pending and 0 rejected."),
      ).toBeInTheDocument();
    });

    it("uses the plural for zero deposits and shows zeroed sums", async () => {
      await renderPage({ deposits: [] });
      const c = within(card("Successful Deposits"));
      expect(c.getByText("You've submitted 0 deposits: 0 approved, 0 pending and 0 rejected.")).toBeInTheDocument();
      expect(c.getByText("$0.00 USD", { selector: "p.text-3xl" })).toBeInTheDocument();
    });

    it("treats a null result as no deposits", async () => {
      await renderPage({ deposits: null });
      expect(within(card("Successful Deposits")).getByText(/You've submitted 0 deposits/)).toBeInTheDocument();
    });

    it("does not count pending or rejected amounts as successful", async () => {
      await renderPage({ deposits: [dep(999, "PENDING"), dep(888, "REJECTED")] });
      expect(within(card("Successful Deposits")).getByText("$0.00 USD", { selector: "p.text-3xl" })).toBeInTheDocument();
    });
  });

  describe("withdrawals card", () => {
    const withdrawals = [dep(200, "COMPLETED"), dep(75.25, "COMPLETED"), dep(40, "PENDING"), dep(10, "REJECTED")];

    it("headlines the completed total", async () => {
      await renderPage({ withdrawals });
      expect(within(card("Successful Withdrawals")).getByText("$275.25 USD")).toBeInTheDocument();
    });

    it("shows submitted, pending and rejected sums", async () => {
      await renderPage({ withdrawals });
      const c = within(card("Successful Withdrawals"));
      expect(c.getByText("Submitted").nextElementSibling).toHaveTextContent("$325.25 USD");
      expect(c.getByText("Pending").nextElementSibling).toHaveTextContent("$40.00 USD");
      expect(c.getByText("Rejected").nextElementSibling).toHaveTextContent("$10.00 USD");
    });

    it("summarises the counts in the footer", async () => {
      await renderPage({ withdrawals });
      expect(
        within(card("Successful Withdrawals")).getByText(
          "You've requested 4 withdrawals: 2 completed, 1 pending and 1 rejected.",
        ),
      ).toBeInTheDocument();
    });

    it("uses the singular for exactly one withdrawal", async () => {
      await renderPage({ withdrawals: [dep(10, "COMPLETED")] });
      expect(
        within(card("Successful Withdrawals")).getByText(
          "You've requested 1 withdrawal: 1 completed, 0 pending and 0 rejected.",
        ),
      ).toBeInTheDocument();
    });

    it("does not count APPROVED as completed for withdrawals", async () => {
      await renderPage({ withdrawals: [dep(50, "APPROVED")] });
      expect(within(card("Successful Withdrawals")).getByText("$0.00 USD", { selector: "p.text-3xl" })).toBeInTheDocument();
    });
  });

  describe("earnings card", () => {
    const balance = { available_balance: "1200.5", total_profit: 340, total_deposited: 1000 };

    it("headlines total profit and lists available, deposited and plan", async () => {
      await renderPage({ balance, profile: { active_plan: "Gold" } });
      const c = within(card("Total Earnings"));
      expect(c.getByText("$340.00 USD")).toBeInTheDocument();
      expect(c.getByText("Available").nextElementSibling).toHaveTextContent("$1,200.50 USD");
      expect(c.getByText("Deposited").nextElementSibling).toHaveTextContent("$1,000.00 USD");
      expect(c.getByText("Plan").nextElementSibling).toHaveTextContent("Gold");
    });

    it("mentions the active plan in the footer", async () => {
      await renderPage({ balance, profile: { active_plan: "Gold" } });
      expect(
        within(card("Total Earnings")).getByText("Your Gold plan is active. Profit is credited to your ledger as it is earned."),
      ).toBeInTheDocument();
    });

    it("shows None and the no-plan footer when there is no active plan", async () => {
      await renderPage({ balance, profile: { active_plan: null } });
      const c = within(card("Total Earnings"));
      expect(c.getByText("Plan").nextElementSibling).toHaveTextContent("None");
      expect(c.getByText(/You have no active plan yet/)).toBeInTheDocument();
    });

    it("falls back to zeros when the user has no balance row or profile", async () => {
      await renderPage({ balance: null, profile: null });
      const c = within(card("Total Earnings"));
      expect(c.getByText("$0.00 USD", { selector: "p.text-3xl" })).toBeInTheDocument();
      expect(c.getByText("Available").nextElementSibling).toHaveTextContent("$0.00 USD");
      expect(c.getByText("Deposited").nextElementSibling).toHaveTextContent("$0.00 USD");
      expect(c.getByText("Plan").nextElementSibling).toHaveTextContent("None");
    });

    it("translates a known plan id (stored by the Plans page) into its display name", async () => {
      await renderPage({ balance, profile: { active_plan: "growth" } });
      const c = within(card("Total Earnings"));
      expect(c.getByText("Plan").nextElementSibling).toHaveTextContent("Growth");
      expect(c.getByText("Your Growth plan is active. Profit is credited to your ledger as it is earned.")).toBeInTheDocument();
    });

    it("falls back to the raw stored value for an unrecognised plan id", async () => {
      // e.g. set by hand in SQL rather than through the Plans page.
      await renderPage({ balance, profile: { active_plan: "Gold" } });
      expect(within(card("Total Earnings")).getByText("Plan").nextElementSibling).toHaveTextContent("Gold");
    });
  });

  describe("plan banner", () => {
    it("invites the user to choose a plan when none is active", async () => {
      await renderPage({ profile: { active_plan: null } });
      expect(screen.getByText("You haven't picked a plan yet")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/dashboard/plans");
    });

    it("names the translated plan and offers to change it", async () => {
      await renderPage({ profile: { active_plan: "elite" } });
      expect(screen.getByText("Your plan: Elite")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Change plan" })).toHaveAttribute("href", "/dashboard/plans");
    });
  });

  describe("two-factor banner", () => {
    it("is shown when the user has no TOTP factor", async () => {
      await renderPage({ totp: [] });
      expect(screen.getByText("2FA Authentication")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "enable 2FA" })).toHaveAttribute("href", "/dashboard/2fa");
    });

    it("is hidden when a TOTP factor is enrolled", async () => {
      await renderPage({ totp: [{ id: "f1" }] });
      expect(screen.queryByText("2FA Authentication")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "enable 2FA" })).not.toBeInTheDocument();
    });
  });

  describe("localisation", () => {
    it("renders French titles and singular/plural footers", async () => {
      locale.current = "fr";
      await renderPage({ deposits: [dep(10, "APPROVED")], withdrawals: [dep(1, "PENDING"), dep(2, "PENDING")] });
      expect(
        within(card("Dépôts réussis")).getByText("Vous avez soumis 1 dépôt : 1 approuvé(s), 0 en attente et 0 rejeté(s)."),
      ).toBeInTheDocument();
      expect(
        within(card("Retraits réussis")).getByText("Vous avez demandé 2 retraits : 0 effectué(s), 2 en attente et 0 rejeté(s)."),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Gains totaux" })).toBeInTheDocument();
    });

    it("looks the active plan id up by locale rather than showing it raw, and translates the banner", async () => {
      locale.current = "fr";
      await renderPage({ profile: { active_plan: "starter" } });
      // The stored id is lowercase ("starter"); a capitalised "Starter" proves it went through
      // translation rather than being echoed verbatim.
      expect(within(card("Gains totaux")).getByText("Plan").nextElementSibling).toHaveTextContent("Starter");
      expect(screen.getByText("Votre plan : Starter")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Changer de plan" })).toHaveAttribute("href", "/dashboard/plans");
    });

    it("renders Chinese footers without plural forms", async () => {
      locale.current = "zh";
      await renderPage({
        deposits: [dep(10, "APPROVED")],
        withdrawals: [dep(1, "COMPLETED"), dep(2, "PENDING"), dep(3, "REJECTED")],
      });
      expect(
        within(card("成功存款")).getByText("您已提交 1 笔存款：1 笔已批准，0 笔待处理，0 笔已拒绝。"),
      ).toBeInTheDocument();
      expect(
        within(card("成功提款")).getByText("您已申请 3 笔提款：1 笔已完成，1 笔待处理，1 笔已拒绝。"),
      ).toBeInTheDocument();
    });

    it("localises the title metadata", async () => {
      locale.current = "zh";
      expect(await generateMetadata()).toEqual({ title: "控制台" });
    });
  });
});
