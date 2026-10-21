import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AdminWithdrawalsPage, { metadata } from "@/app/admin/withdrawals/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";
import type { Withdrawal } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/withdrawals", () => ({ resolveWithdrawal: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

const withdrawal = (overrides: Partial<Withdrawal>): Withdrawal => ({
  id: "w1",
  user_id: "u1",
  amount: 500,
  payout_method: "BANK_TRANSFER",
  payout_details: "Acct 0123456789",
  status: "PENDING",
  rejection_reason: null,
  created_at: "2026-03-05T10:30:00.000Z",
  resolved_at: null,
  resolved_by: null,
  profiles: { email: "ada@example.com", full_name: "Ada" },
  ...overrides,
});

async function renderPage() {
  return renderWithIntl(await AdminWithdrawalsPage());
}

describe("AdminWithdrawalsPage", () => {
  beforeEach(() => {
    mockDb({
      withdrawals: {
        data: [withdrawal({ id: "w1" }), withdrawal({ id: "w2", amount: 75, payout_method: "BTC", payout_details: "bc1qabc" })],
      },
    });
  });

  it("has the Withdrawals title", () => {
    expect(metadata.title).toBe("Withdrawals");
  });

  it("renders the heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Pending Withdrawals" })).toBeInTheDocument();
  });

  it("only fetches PENDING withdrawals, oldest first, with the requester's profile", async () => {
    const { builders, client } = mockDb({});
    await renderPage();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("withdrawals");
    expect(builders.withdrawals.calls).toEqual([
      { method: "select", args: ["*, profiles(email, full_name)"] },
      { method: "eq", args: ["status", "PENDING"] },
      { method: "order", args: ["created_at", { ascending: true }] },
    ]);
  });

  it("renders a queue row with approve and reject buttons for each withdrawal", async () => {
    await renderPage();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Approve/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Reject/ })).toHaveLength(2);
  });

  it("shows payout methods and details", async () => {
    await renderPage();
    expect(screen.getByText("BANK TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("Payout details: bc1qabc")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is pending", async () => {
    mockDb({ withdrawals: { data: [] } });
    await renderPage();
    expect(screen.getByText("No pending withdrawals.")).toBeInTheDocument();
  });

  it("treats a null result as empty", async () => {
    mockDb({ withdrawals: { data: null } });
    await renderPage();
    expect(screen.getByText("No pending withdrawals.")).toBeInTheDocument();
  });
});
