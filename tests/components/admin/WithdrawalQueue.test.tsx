import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { WithdrawalQueue } from "@/components/admin/WithdrawalQueue";
import { resolveWithdrawal } from "@/lib/actions/withdrawals";
import { formatCurrency, formatDate } from "@/lib/utils";
import { renderWithIntl, type userEvent } from "@tests/helpers/utils";
import type { Withdrawal } from "@/lib/types";

vi.mock("@/lib/actions/withdrawals", () => ({ resolveWithdrawal: vi.fn() }));

const resolve = vi.mocked(resolveWithdrawal);

function makeRow(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    id: "r1",
    user_id: "u1",
    amount: 1250.5,
    payout_method: "BANK_TRANSFER",
    payout_details: "Bank 0123456789",
    status: "PENDING",
    rejection_reason: null,
    created_at: "2026-03-05T10:30:00.000Z",
    resolved_at: null,
    profiles: { email: "ada@example.com", full_name: "Ada Lovelace" },
    ...overrides,
  } as Withdrawal;
}

const ROWS = [
  makeRow({ id: "r1", amount: 1250.5 }),
  makeRow({ id: "r2", amount: 40, payout_method: "BTC", profiles: { email: "bob@example.com", full_name: null } } as Partial<Withdrawal>),
  makeRow({ id: "r3", amount: 99999.99, payout_method: "USDT", profiles: { email: "cy@example.com", full_name: "Cy Young" } } as Partial<Withdrawal>),
];

const card = (text: string) => screen.getByText(text).closest("div.glass-card") as HTMLElement;
const approveIn = (el: HTMLElement) => within(el).getByRole("button", { name: /Approve/ });
const rejectIn = (el: HTMLElement) => within(el).getByRole("button", { name: /Reject/ });

function setup(rows = ROWS) {
  return renderWithIntl(<WithdrawalQueue initialWithdrawals={rows} />);
}

beforeEach(() => {
  resolve.mockResolvedValue({ success: true });
});

describe("WithdrawalQueue list", () => {
  it("renders one card per pending item with amount, user and date", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /Approve/ })).toHaveLength(3);
    expect(screen.getByText(formatCurrency(1250.5))).toBeInTheDocument();
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
    expect(screen.getByText("$99,999.99")).toBeInTheDocument();
    expect(within(card("$1,250.50")).getByText(formatDate("2026-03-05T10:30:00.000Z"))).toBeInTheDocument();
  });

  it("shows the full name, falling back to the email", () => {
    setup();
    expect(within(card("$1,250.50")).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(card("$40.00")).getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows the payout method with underscores replaced", () => {
    setup();
    expect(within(card("$1,250.50")).getByText("BANK TRANSFER")).toBeInTheDocument();
    expect(within(card("$40.00")).getByText("BTC")).toBeInTheDocument();
  });

  it("shows the Payout details", () => {
    setup();
    expect(within(card("$1,250.50")).getByText(/Payout details: Bank 0123456789/)).toBeInTheDocument();
  });

  it("labels the payout details with the row's details string", () => {
    setup([makeRow({ payout_details: "bc1qexampleaddress" })]);
    expect(screen.getByText("Payout details: bc1qexampleaddress")).toBeInTheDocument();
  });

  it("renders the empty state when there is nothing pending", () => {
    setup([]);
    expect(screen.getByText("No pending withdrawals.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("WithdrawalQueue approve", () => {
  it("calls the action with the row id and COMPLETED", async () => {
    const { user } = setup();
    await user.click(approveIn(card("$40.00")));
    expect(resolve).toHaveBeenCalledExactlyOnceWith("r2", "COMPLETED");
  });

  it("removes only the approved row", async () => {
    const { user } = setup();
    await user.click(approveIn(card("$40.00")));
    await waitFor(() => expect(screen.queryByText("$40.00")).not.toBeInTheDocument());
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
    expect(screen.getByText("$99,999.99")).toBeInTheDocument();
  });

  it("shows the empty state after the last row is approved", async () => {
    const { user } = setup([makeRow()]);
    await user.click(approveIn(card("$1,250.50")));
    expect(await screen.findByText("No pending withdrawals.")).toBeInTheDocument();
  });

  it("tells the admin why an approval failed", async () => {
    resolve.mockResolvedValue({ error: "Withdrawal already resolved" });
    const { user } = setup();
    await user.click(approveIn(card("$40.00")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Withdrawal already resolved");
  });

  it("keeps the row when the action returns an error", async () => {
    resolve.mockResolvedValue({ error: "Something went wrong" });
    const { user } = setup();
    await user.click(approveIn(card("$40.00")));

    await waitFor(() => expect(approveIn(card("$40.00"))).toBeEnabled());
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(screen.getByText("$40.00")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Approve/ })).toHaveLength(3);
  });

  it("can retry after a failed approval", async () => {
    resolve.mockResolvedValueOnce({ error: "Temporary" }).mockResolvedValueOnce({ success: true });
    const { user } = setup();
    await user.click(approveIn(card("$40.00")));
    await waitFor(() => expect(approveIn(card("$40.00"))).toBeEnabled());
    await user.click(approveIn(card("$40.00")));

    await waitFor(() => expect(screen.queryByText("$40.00")).not.toBeInTheDocument());
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("disables every button and ignores further clicks while a request is in flight", async () => {
    let finish!: (v: { success: boolean }) => void;
    resolve.mockReturnValue(new Promise((r) => (finish = r)));
    const { user, container } = setup();
    await user.click(approveIn(card("$40.00")));

    expect(approveIn(card("$40.00"))).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /Reject/ })) expect(button).toBeDisabled();

    await user.click(approveIn(card("$1,250.50")));
    expect(resolve).toHaveBeenCalledTimes(1);

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.queryByText("$40.00")).not.toBeInTheDocument());
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});

describe("WithdrawalQueue reject", () => {
  async function openReject(user: ReturnType<typeof userEvent.setup>, amount = "$40.00") {
    await user.click(rejectIn(card(amount)));
    return screen.findByRole("dialog");
  }

  it("opens the drawer titled Reject Withdrawal without calling the action", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    expect(within(dialog).getByRole("heading", { name: "Reject Withdrawal" })).toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("explains the consequence for the chosen amount", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    expect(dialog).toHaveTextContent(/This will refund \$40\.00 back to the user's available balance and notify them by email\./);
  });

  it("offers a reason field and a confirm button", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    expect(within(dialog).getByLabelText("Rejection reason")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Rejection" })).toBeEnabled();
  });

  it("passes the typed reason to the action with REJECTED", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    await user.type(within(dialog).getByLabelText("Rejection reason"), "Details do not match");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));

    expect(resolve).toHaveBeenCalledExactlyOnceWith("r2", "REJECTED", "Details do not match");
  });

  it("removes the rejected row and closes the drawer on success", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    await user.type(within(dialog).getByLabelText("Rejection reason"), "Nope");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("$40.00")).not.toBeInTheDocument();
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
  });

  it("rejects the row that was clicked, not another one", async () => {
    const { user } = setup();
    const dialog = await openReject(user, "$99,999.99");
    await user.type(within(dialog).getByLabelText("Rejection reason"), "Fraud");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
    expect(resolve).toHaveBeenCalledWith("r3", "REJECTED", "Fraud");
  });

  it("sends an empty reason when none was typed", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
    expect(resolve).toHaveBeenCalledExactlyOnceWith("r2", "REJECTED", "");
  });

  it("keeps the row, the drawer and the typed reason when the action fails", async () => {
    resolve.mockResolvedValue({ error: "Failed" });
    const { user } = setup();
    const dialog = await openReject(user);
    await user.type(within(dialog).getByLabelText("Rejection reason"), "Because");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));

    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Confirm Rejection" })).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText("Rejection reason")).toHaveValue("Because");
    expect(screen.getByText("$40.00", { selector: "p" })).toBeInTheDocument();
  });

  it("closes the drawer without calling the action when dismissed", async () => {
    const { user } = setup();
    const dialog = await openReject(user);
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(resolve).not.toHaveBeenCalled();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
  });

  it("discards a half-typed reason when the drawer is dismissed, so it cannot leak onto another row", async () => {
    const { user } = setup();
    let dialog = await openReject(user);
    await user.type(within(dialog).getByLabelText("Rejection reason"), "Typed for the wrong row");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog = await openReject(user, "$1,250.50");
    expect(within(dialog).getByLabelText("Rejection reason")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
    expect(resolve).toHaveBeenCalledExactlyOnceWith("r1", "REJECTED", "");
  });

  it("clears the reason after a successful rejection so the next drawer starts empty", async () => {
    const { user } = setup();
    let dialog = await openReject(user);
    await user.type(within(dialog).getByLabelText("Rejection reason"), "First reason");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog = await openReject(user, "$1,250.50");
    expect(within(dialog).getByLabelText("Rejection reason")).toHaveValue("");
  });
});
