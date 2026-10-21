import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { toggleUserFreeze } from "@/lib/actions/settings";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/settings", () => ({ toggleUserFreeze: vi.fn() }));
vi.mock("@/lib/actions/messages", () => ({
  getMessageThread: vi.fn(async () => ({ messages: [] })),
  markMessagesRead: vi.fn(async () => ({ success: true })),
  sendAdminMessage: vi.fn(async () => ({ success: true })),
}));

const freeze = vi.mocked(toggleUserFreeze);

const ROWS: AdminUserRow[] = [
  { id: "u1", email: "ada@example.com", full_name: "Ada Lovelace", role: "USER", is_frozen: false, available_balance: 1234.5, unread_messages: 0 },
  { id: "u2", email: "bob@example.com", full_name: null, role: "ADMIN", is_frozen: true, available_balance: 0, unread_messages: 2 },
];

/** ResponsiveTable renders both a desktop table and mobile cards; query the table for uniqueness. */
const table = () => screen.getByRole("table");
const rowFor = (email: string) => within(table()).getByText(email).closest("tr") as HTMLElement;

beforeEach(() => {
  freeze.mockResolvedValue({ success: true });
});

describe("UserTable", () => {
  it("renders the column headers", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["User", "Balance", "Status", "Actions"]);
  });

  it("renders one table row per user", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(table()).getAllByRole("row")).toHaveLength(1 + ROWS.length);
  });

  it("shows name and email, with a dash for missing names", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(rowFor("ada@example.com")).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByText("—")).toBeInTheDocument();
  });

  it("formats balances as currency", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(rowFor("ada@example.com")).getByText("$1,234.50")).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByText("$0.00")).toBeInTheDocument();
  });

  it("badges frozen and active users", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    const active = within(rowFor("ada@example.com")).getByText("Active");
    const frozen = within(rowFor("bob@example.com")).getByText("Frozen");
    expect(active).toHaveClass("text-emerald-400");
    expect(frozen).toHaveClass("text-red-400");
  });

  it("links Adjust Balance to the ledger console for that user", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(rowFor("ada@example.com")).getByRole("link", { name: "Adjust Balance" })).toHaveAttribute(
      "href",
      "/admin/ledger?userId=u1",
    );
    expect(within(rowFor("bob@example.com")).getByRole("link", { name: "Adjust Balance" })).toHaveAttribute(
      "href",
      "/admin/ledger?userId=u2",
    );
  });

  it("offers Freeze for active users and Unfreeze for frozen ones", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(rowFor("ada@example.com")).getByRole("button", { name: "Freeze" })).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByRole("button", { name: "Unfreeze" })).toBeInTheDocument();
  });

  it("freezes the right user when the row's button is clicked", async () => {
    const { user } = renderWithIntl(<UserTable rows={ROWS} />);
    await user.click(within(rowFor("ada@example.com")).getByRole("button", { name: "Freeze" }));
    expect(freeze).toHaveBeenCalledExactlyOnceWith("u1", true);
    expect(await within(rowFor("ada@example.com")).findByRole("button", { name: "Unfreeze" })).toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByRole("button", { name: "Unfreeze" })).toBeInTheDocument();
  });

  it("shows a Message button for every user, with an unread badge when they have replies waiting", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(within(rowFor("ada@example.com")).getByRole("button", { name: /message/i })).toBeInTheDocument();
    expect(within(rowFor("ada@example.com")).queryByText("2")).not.toBeInTheDocument();
    expect(within(rowFor("bob@example.com")).getByText("2")).toBeInTheDocument();
  });

  it("also renders stacked mobile cards with the same data", () => {
    renderWithIntl(<UserTable rows={ROWS} />);
    expect(screen.getAllByText("ada@example.com")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Adjust Balance" })).toHaveLength(4);
  });

  it("shows the empty state when there are no users", () => {
    renderWithIntl(<UserTable rows={[]} />);
    expect(screen.getByText("No users found.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
