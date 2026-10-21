import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import AdminLedgerPage, { metadata } from "@/app/admin/ledger/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/ledger", () => ({ applyLedgerEntry: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

const USERS = [
  { id: "u1", email: "ada@example.com", full_name: "Ada Lovelace" },
  { id: "u2", email: "bob@example.com", full_name: null },
];

async function renderPage(searchParams: { userId?: string } = {}) {
  return renderWithIntl(await AdminLedgerPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("AdminLedgerPage", () => {
  beforeEach(() => {
    mockDb({ profiles: { data: USERS } });
  });

  it("has the Manual Ledger title", () => {
    expect(metadata.title).toBe("Manual Ledger");
  });

  it("renders the console heading and form", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Manual Ledger Console" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Entry" })).toBeInTheDocument();
  });

  it("loads users sorted by email", async () => {
    const { builders, client } = mockDb({ profiles: { data: USERS } });
    await renderPage();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("profiles");
    expect(builders.profiles.calls).toEqual([
      { method: "select", args: ["id, email, full_name"] },
      { method: "order", args: ["email"] },
    ]);
  });

  it("offers the loaded users in the picker", async () => {
    await renderPage();
    expect(screen.getByRole("option", { name: "Ada Lovelace — ada@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "bob@example.com" })).toBeInTheDocument();
  });

  it("has no user preselected without a userId", async () => {
    await renderPage();
    expect(screen.getByLabelText("User")).toHaveValue("");
  });

  it("preselects the user from the ?userId= query parameter", async () => {
    await renderPage({ userId: "u2" });
    expect(screen.getByLabelText("User")).toHaveValue("u2");
  });

  it("still renders when no users could be loaded", async () => {
    mockDb({ profiles: { data: null } });
    await renderPage();
    expect(within(screen.getByLabelText("User")).getAllByRole("option")).toHaveLength(1);
  });
});
