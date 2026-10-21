import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLayout from "@/app/dashboard/layout";
import { requireUser } from "@/lib/auth/guard";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

const shell = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
    shell.props = props;
    return <div data-testid="shell">{children}</div>;
  },
}));

async function renderLayout(
  data: {
    profile?: Record<string, unknown> | null;
    balance?: Record<string, unknown> | null;
    email?: string | undefined;
    unreadMessages?: number;
  } = {},
) {
  const mock = createSupabaseMock({
    tables: {
      profiles: { data: data.profile === undefined ? null : data.profile },
      balances: { data: data.balance === undefined ? null : data.balance },
      messages: { count: data.unreadMessages ?? 0 },
    },
  });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "email" in data ? data.email : "auth@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
  render(await DashboardLayout({ children: <p>child page</p> }));
  return mock;
}

describe("dashboard layout", () => {
  it("wraps the children in the dashboard shell", async () => {
    await renderLayout();
    expect(screen.getByTestId("shell")).toContainElement(screen.getByText("child page"));
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(DashboardLayout({ children: null })).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("passes the user's id, name, email and balance to the shell", async () => {
    await renderLayout({
      profile: { full_name: "Ada Lovelace", email: "ada@example.com", role: "USER" },
      balance: { available_balance: "1234.5" },
    });
    expect(shell.props).toEqual({
      userId: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      balance: 1234.5,
      isAdmin: false,
      unreadMessages: 0,
    });
  });

  it("flags admins", async () => {
    await renderLayout({ profile: { full_name: "Root", email: "root@example.com", role: "ADMIN" }, balance: { available_balance: 0 } });
    expect(shell.props?.isAdmin).toBe(true);
  });

  it("falls back to the auth email, a null name and a zero balance when rows are missing", async () => {
    await renderLayout({ profile: null, balance: null });
    expect(shell.props).toMatchObject({ name: null, email: "auth@example.com", balance: 0, isAdmin: false });
  });

  it("uses an empty email when neither the profile nor the auth user has one", async () => {
    await renderLayout({ profile: null, balance: null, email: undefined });
    expect(shell.props?.email).toBe("");
  });

  it("passes the unread admin-message count to the shell", async () => {
    await renderLayout({ unreadMessages: 4 });
    expect(shell.props?.unreadMessages).toBe(4);
  });

  it("queries for this user's unread admin messages", async () => {
    const mock = await renderLayout();
    const calls = mock.builders.messages.calls;
    expect(calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(calls).toContainEqual({ method: "eq", args: ["sender", "ADMIN"] });
    expect(calls).toContainEqual({ method: "is", args: ["read_at", null] });
  });

  it("defaults the unread count to zero when the query returns no count", async () => {
    await renderLayout();
    expect(shell.props?.unreadMessages).toBe(0);
  });
});
