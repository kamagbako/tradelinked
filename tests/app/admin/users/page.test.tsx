import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import AdminUsersPage, { metadata } from "@/app/admin/users/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/settings", () => ({ toggleUserFreeze: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

const DATA = [
  { id: "u1", email: "ada@example.com", full_name: "Ada Lovelace", role: "USER", is_frozen: false, balances: { available_balance: "1500.5" } },
  { id: "u2", email: "bob@example.com", full_name: null, role: "ADMIN", is_frozen: true, balances: [{ available_balance: 20 }] },
  { id: "u3", email: "cy@example.com", full_name: "Cy", role: "USER", is_frozen: false, balances: null },
  { id: "u4", email: "di@example.com", full_name: "Di", role: "USER", is_frozen: false, balances: [] },
];

async function renderPage(searchParams: { q?: string } = {}) {
  return renderWithIntl(await AdminUsersPage({ searchParams: Promise.resolve(searchParams) }));
}

const rowFor = (email: string) => within(screen.getByRole("table")).getByText(email).closest("tr") as HTMLElement;

describe("AdminUsersPage search", () => {
  const orCalls = (mock: ReturnType<typeof mockDb>) =>
    mock.builders.profiles.calls.filter((c) => c.method === "or").map((c) => c.args[0]);

  it("does not let a crafted search inject extra filter clauses", async () => {
    const mock = mockDb({ profiles: { data: DATA } });
    await renderPage({ q: "x,role.eq.ADMIN)" });
    const [filter] = orCalls(mock) as string[];
    // exactly the two intended clauses (one comma), and no raw parentheses from user input
    expect(filter.split(",")).toHaveLength(2);
    expect(filter).toBe("email.ilike.%x role.eq.ADMIN%,full_name.ilike.%x role.eq.ADMIN%");
  });

  it("skips the filter when the search is only special characters", async () => {
    const mock = mockDb({ profiles: { data: DATA } });
    await renderPage({ q: ",,()%" });
    expect(orCalls(mock)).toHaveLength(0);
  });
});

describe("AdminUsersPage", () => {
  it("has the Users title", () => {
    expect(metadata.title).toBe("Users");
  });

  it("renders the directory heading and search box", async () => {
    mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "User Directory" })).toBeInTheDocument();
    const search = screen.getByRole("searchbox");
    expect(search).toHaveAttribute("name", "q");
    expect(search).toHaveAttribute("placeholder", "Search by name or email");
  });

  it("requests profiles with their balance, newest first", async () => {
    const { builders } = mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(builders.profiles.calls).toEqual([
      { method: "select", args: ["id, email, full_name, role, is_frozen, balances(available_balance)"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("applies no filter without a search term", async () => {
    const { builders } = mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(builders.profiles.calls.map((c) => c.method)).not.toContain("or");
  });

  it("filters by name or email with the search term", async () => {
    const { builders } = mockDb({ profiles: { data: DATA } });
    await renderPage({ q: "ada" });
    expect(builders.profiles.calls).toContainEqual({ method: "or", args: ["email.ilike.%ada%,full_name.ilike.%ada%"] });
  });

  it("keeps the search term in the box", async () => {
    mockDb({ profiles: { data: DATA } });
    await renderPage({ q: "ada" });
    expect(screen.getByRole("searchbox")).toHaveValue("ada");
  });

  it("renders one row per profile", async () => {
    mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1 + DATA.length);
  });

  it("normalises balances given as an object, an array, null or an empty array", async () => {
    mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(within(rowFor("ada@example.com")).getByText("$1,500.50")).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByText("$20.00")).toBeInTheDocument();
    expect(within(rowFor("cy@example.com")).getByText("$0.00")).toBeInTheDocument();
    expect(within(rowFor("di@example.com")).getByText("$0.00")).toBeInTheDocument();
  });

  it("shows frozen and active status", async () => {
    mockDb({ profiles: { data: DATA } });
    await renderPage();
    expect(within(rowFor("bob@example.com")).getByText("Frozen")).toBeInTheDocument();
    expect(within(rowFor("ada@example.com")).getByText("Active")).toBeInTheDocument();
  });

  it("shows the empty state when no users match", async () => {
    mockDb({ profiles: { data: [] } });
    await renderPage({ q: "zzz" });
    expect(screen.getByText("No users found.")).toBeInTheDocument();
  });

  it("treats a null result as empty", async () => {
    mockDb({ profiles: { data: null } });
    await renderPage();
    expect(screen.getByText("No users found.")).toBeInTheDocument();
  });
});

describe("AdminUsersPage unread messages", () => {
  it("requests unread messages sent by users", async () => {
    const { builders } = mockDb({ profiles: { data: DATA }, messages: { data: [] } });
    await renderPage();
    expect(builders.messages.calls).toContainEqual({ method: "select", args: ["user_id"] });
    expect(builders.messages.calls).toContainEqual({ method: "eq", args: ["sender", "USER"] });
    expect(builders.messages.calls).toContainEqual({ method: "is", args: ["read_at", null] });
  });

  it("shows a Message button for every user, with a badge counting their unread replies", async () => {
    mockDb({
      profiles: { data: DATA },
      messages: { data: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u2" }] },
    });
    await renderPage();
    expect(within(rowFor("ada@example.com")).getByText("2")).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByText("1")).toBeInTheDocument();
    expect(within(rowFor("cy@example.com")).getByRole("button", { name: /message/i })).toBeInTheDocument();
    expect(within(rowFor("cy@example.com")).queryByText("1")).not.toBeInTheDocument();
  });

  it("treats a null unread-messages result as no unread messages for anyone", async () => {
    mockDb({ profiles: { data: DATA }, messages: { data: null } });
    await renderPage();
    for (const row of DATA) {
      expect(within(rowFor(row.email)).queryByText(/^\d+$/)).not.toBeInTheDocument();
    }
  });
});
