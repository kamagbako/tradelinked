import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AdminDepositsPage, { metadata } from "@/app/admin/deposits/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";
import type { Deposit } from "@/lib/types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/deposits", () => ({ resolveDeposit: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

const deposit = (overrides: Partial<Deposit>): Deposit => ({
  id: "d1",
  user_id: "u1",
  amount: 500,
  method: "BANK_TRANSFER",
  reference: "REF-1",
  status: "PENDING",
  rejection_reason: null,
  created_at: "2026-03-05T10:30:00.000Z",
  resolved_at: null,
  profiles: { email: "ada@example.com", full_name: "Ada" },
  ...overrides,
});

async function renderPage() {
  return renderWithIntl(await AdminDepositsPage());
}

describe("AdminDepositsPage", () => {
  beforeEach(() => {
    mockDb({ deposits: { data: [deposit({ id: "d1" }), deposit({ id: "d2", amount: 75, method: "BTC", reference: null })] } });
  });

  it("has the Deposits title", () => {
    expect(metadata.title).toBe("Deposits");
  });

  it("renders the heading and the verification guidance", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Pending Deposits" })).toBeInTheDocument();
    expect(screen.getByText(/Verify each transfer against your bank or wallet before approving/)).toBeInTheDocument();
  });

  it("only fetches PENDING deposits, oldest first, with the depositor's profile", async () => {
    const { builders, client } = mockDb({});
    await renderPage();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("deposits");
    expect(builders.deposits.calls).toEqual([
      { method: "select", args: ["*, profiles(email, full_name)"] },
      { method: "eq", args: ["status", "PENDING"] },
      { method: "order", args: ["created_at", { ascending: true }] },
    ]);
  });

  it("renders a queue row with approve and reject buttons for each deposit", async () => {
    await renderPage();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Approve/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Reject/ })).toHaveLength(2);
  });

  it("shows the reference or a placeholder", async () => {
    await renderPage();
    expect(screen.getByText("Reference: REF-1")).toBeInTheDocument();
    expect(screen.getByText("Reference: none given")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is pending", async () => {
    mockDb({ deposits: { data: [] } });
    await renderPage();
    expect(screen.getByText("No pending deposits.")).toBeInTheDocument();
  });

  it("treats a null result as empty", async () => {
    mockDb({ deposits: { data: null } });
    await renderPage();
    expect(screen.getByText("No pending deposits.")).toBeInTheDocument();
  });
});
