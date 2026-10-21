import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AdminOverviewPage, { metadata } from "@/app/admin/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

async function renderPage() {
  return renderWithIntl(await AdminOverviewPage());
}

const metric = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    mockDb({
      profiles: { count: 42 },
      balances: {
        data: [
          { available_balance: 1000.25, total_profit: 100 },
          { available_balance: "2500.50", total_profit: "50.5" },
          { available_balance: 0, total_profit: 0 },
        ],
      },
      withdrawals: { data: [{ amount: 300 }, { amount: "125.25" }] },
    });
  });

  it("has the Admin Overview title", () => {
    expect(metadata.title).toBe("Admin Overview");
  });

  it("renders the page heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Platform Overview" })).toBeInTheDocument();
  });

  it("shows the total user count", async () => {
    await renderPage();
    expect(metric("Total Users")).toHaveTextContent("42");
  });

  it("sums available balances across users", async () => {
    await renderPage();
    expect(metric("Platform Balance")).toHaveTextContent("$3,500.75");
  });

  it("sums total profit across users, coercing string decimals", async () => {
    await renderPage();
    expect(metric("Total Profit Distributed")).toHaveTextContent("$150.50");
  });

  it("shows the number and total of pending withdrawals", async () => {
    await renderPage();
    expect(metric("Pending Withdrawals")).toHaveTextContent("2 ($425.25)");
  });

  it("renders four metric cards", async () => {
    await renderPage();
    for (const label of ["Total Users", "Platform Balance", "Total Profit Distributed", "Pending Withdrawals"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("counts profiles with a head-only exact count query", async () => {
    const { builders } = mockDb({});
    await renderPage();
    expect(builders.profiles.calls).toContainEqual({ method: "select", args: ["id", { count: "exact", head: true }] });
  });

  it("reads balances columns needed for the sums", async () => {
    const { builders } = mockDb({});
    await renderPage();
    expect(builders.balances.calls).toContainEqual({ method: "select", args: ["available_balance, total_profit"] });
  });

  it("only sums withdrawals whose status is PENDING", async () => {
    const { builders } = mockDb({});
    await renderPage();
    expect(builders.withdrawals.calls).toEqual([
      { method: "select", args: ["amount"] },
      { method: "eq", args: ["status", "PENDING"] },
    ]);
  });

  it("queries exactly profiles, balances and withdrawals", async () => {
    const { client } = mockDb({});
    await renderPage();
    expect(client.from.mock.calls.map(([table]) => table).sort()).toEqual(["balances", "profiles", "withdrawals"]);
  });

  it("shows zeros when the platform is empty", async () => {
    mockDb({ profiles: { count: null }, balances: { data: null }, withdrawals: { data: null } });
    await renderPage();
    expect(metric("Total Users")).toHaveTextContent("0");
    expect(metric("Platform Balance")).toHaveTextContent("$0.00");
    expect(metric("Total Profit Distributed")).toHaveTextContent("$0.00");
    expect(metric("Pending Withdrawals")).toHaveTextContent("0 ($0.00)");
  });
});
