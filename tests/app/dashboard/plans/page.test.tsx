import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import PlansPage, { generateMetadata } from "@/app/dashboard/plans/page";
import { requireUser } from "@/lib/auth/guard";
import { loadMessages } from "@tests/helpers/messages";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

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
vi.mock("@/components/dashboard/PlansPicker", () => ({
  PlansPicker: (props: { activePlanId: string | null; availableBalance: number }) => (
    <div data-testid="plans-picker" data-active={props.activePlanId ?? ""} data-balance={props.availableBalance} />
  ),
}));

beforeEach(() => {
  locale.current = "en";
});

async function renderPage({
  activePlan = null as string | null,
  availableBalance = 0 as number | null,
}: { activePlan?: string | null; availableBalance?: number | null } = {}) {
  const mock = createSupabaseMock({
    tables: {
      profiles: { data: { active_plan: activePlan } },
      balances: { data: availableBalance === null ? null : { available_balance: availableBalance } },
    },
  });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await PlansPage();
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

describe("plans page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Plans" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(PlansPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading, subtitle and the picker", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Investment Plans" })).toBeInTheDocument();
    expect(screen.getByText("Pick the plan that matches how much you have available to invest.")).toBeInTheDocument();
    expect(screen.getByTestId("plans-picker")).toBeInTheDocument();
  });

  it("passes the user's active plan id and available balance to the picker", async () => {
    await renderPage({ activePlan: "growth", availableBalance: 1234.5 });
    const picker = screen.getByTestId("plans-picker");
    expect(picker).toHaveAttribute("data-active", "growth");
    expect(picker).toHaveAttribute("data-balance", "1234.5");
  });

  it("passes null when the user has no active plan", async () => {
    await renderPage({ activePlan: null });
    expect(screen.getByTestId("plans-picker")).toHaveAttribute("data-active", "");
  });

  it("treats a missing balance row as zero", async () => {
    await renderPage({ availableBalance: null });
    expect(screen.getByTestId("plans-picker")).toHaveAttribute("data-balance", "0");
  });

  it("queries only this user's own profile and balance rows", async () => {
    const { builders } = await renderPage();
    expect(builders.profiles.calls).toContainEqual({ method: "eq", args: ["id", "user-1"] });
    expect(builders.balances.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
  });

  it("renders French copy", async () => {
    locale.current = "fr";
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Plans d’investissement" })).toBeInTheDocument();
    expect(await generateMetadata()).toEqual({ title: "Plans" });
  });

  it("renders Chinese copy", async () => {
    locale.current = "zh";
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "投资计划" })).toBeInTheDocument();
  });
});
