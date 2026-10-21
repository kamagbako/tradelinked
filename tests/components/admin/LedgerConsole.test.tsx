import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LedgerConsole } from "@/components/admin/LedgerConsole";
import { applyLedgerEntry } from "@/lib/actions/ledger";

vi.mock("@/lib/actions/ledger", () => ({ applyLedgerEntry: vi.fn() }));

const apply = vi.mocked(applyLedgerEntry);

const USERS = [
  { id: "u1", email: "ada@example.com", full_name: "Ada Lovelace" },
  { id: "u2", email: "bob@example.com", full_name: null },
];

const field = {
  user: () => screen.getByLabelText("User") as HTMLSelectElement,
  type: () => screen.getByLabelText("Entry type") as HTMLSelectElement,
  amount: () => screen.getByLabelText("Amount (USD)") as HTMLInputElement,
  note: () => screen.getByLabelText("Note") as HTMLTextAreaElement,
  submit: () => screen.getByRole("button", { name: "Apply Entry" }),
};

/**
 * React 19 resets uncontrolled form fields whenever a form action runs. user-event caches the value it last
 * typed, so after a reset fireEvent.change is the reliable way to enter values again.
 */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, note = "") {
  await user.selectOptions(field.user(), "u1");
  await user.selectOptions(field.type(), "CREDIT");
  fireEvent.change(field.amount(), { target: { value: "25.5" } });
  fireEvent.change(field.note(), { target: { value: note } });
  await user.click(field.submit());
}

beforeEach(() => {
  apply.mockResolvedValue({ success: true });
});

describe("LedgerConsole", () => {
  it("renders the form fields and submit button", () => {
    render(<LedgerConsole users={USERS} />);
    expect(screen.getByRole("heading", { name: "Manual Ledger Entry" })).toBeInTheDocument();
    expect(field.user()).toBeRequired();
    expect(field.type()).toBeRequired();
    expect(field.amount()).toBeRequired();
    expect(field.amount()).toHaveAttribute("min", "0.01");
    expect(field.amount()).toHaveAttribute("step", "0.01");
    expect(field.submit()).toBeEnabled();
  });

  it("lists users as 'name — email' or just the email", () => {
    render(<LedgerConsole users={USERS} />);
    const labels = Array.from(field.user().options).map((o) => o.textContent);
    expect(labels).toEqual(["Select a user", "Ada Lovelace — ada@example.com", "bob@example.com"]);
  });

  it("offers Credit, Debit and Profit Yield entry types", () => {
    render(<LedgerConsole users={USERS} />);
    const options = Array.from(field.type().options).map((o) => [o.value, o.textContent]);
    expect(options).toEqual([
      ["", "Select a type"],
      ["CREDIT", "Credit"],
      ["DEBIT", "Debit"],
      ["PROFIT_YIELD", "Profit Yield"],
    ]);
  });

  it("starts with no user selected", () => {
    render(<LedgerConsole users={USERS} />);
    expect(field.user()).toHaveValue("");
    expect(field.type()).toHaveValue("");
  });

  it("preselects the default user (e.g. from ?userId=)", () => {
    render(<LedgerConsole users={USERS} defaultUserId="u2" />);
    expect(field.user()).toHaveValue("u2");
  });

  it("renders with no users at all", () => {
    render(<LedgerConsole users={[]} />);
    expect(field.user().options).toHaveLength(1);
  });

  it("posts the form values as FormData", async () => {
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user, "Bonus");

    expect(apply).toHaveBeenCalledTimes(1);
    const formData = apply.mock.calls[0][0];
    expect(formData).toBeInstanceOf(FormData);
    expect(Object.fromEntries(formData.entries())).toEqual({
      userId: "u1",
      type: "CREDIT",
      amount: "25.5",
      note: "Bonus",
    });
  });

  it("includes the preselected user and a debit type in the submission", async () => {
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} defaultUserId="u2" />);
    await user.selectOptions(field.type(), "DEBIT");
    await user.type(field.amount(), "3");
    await user.click(field.submit());

    const formData = apply.mock.calls[0][0];
    expect(formData.get("userId")).toBe("u2");
    expect(formData.get("type")).toBe("DEBIT");
    expect(formData.get("amount")).toBe("3");
    expect(formData.get("note")).toBe("");
  });

  it("does not submit when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await user.click(field.submit());
    expect(apply).not.toHaveBeenCalled();
  });

  it("shows a success message and resets the form", async () => {
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user, "Bonus");

    expect(await screen.findByText("Ledger entry applied.")).toHaveClass("text-emerald-400");
    await waitFor(() => expect(field.amount()).toHaveValue(null));
    expect(field.note()).toHaveValue("");
    expect(field.user()).toHaveValue("");
    expect(screen.queryByText(/insufficient/i)).not.toBeInTheDocument();
  });

  it("keeps the entered values after the action returns an error", async () => {
    apply.mockResolvedValue({ error: "Insufficient balance" });
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user, "Manual debit");

    expect(await screen.findByText("Insufficient balance")).toBeInTheDocument();
    expect(field.user()).toHaveValue("u1");
    expect(field.type()).toHaveValue("CREDIT");
    expect(field.amount()).toHaveValue(25.5);
    expect(field.note()).toHaveValue("Manual debit");
  });

  it("shows the error message returned by the action", async () => {
    apply.mockResolvedValue({ error: "Insufficient balance" });
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user, "Oops");

    expect(await screen.findByText("Insufficient balance")).toHaveClass("text-red-400");
    expect(screen.queryByText("Ledger entry applied.")).not.toBeInTheDocument();
  });

  it("replaces an old error with the success message on the next attempt", async () => {
    apply.mockResolvedValueOnce({ error: "First failure" }).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user);
    expect(await screen.findByText("First failure")).toBeInTheDocument();
    await waitFor(() => expect(field.submit()).toBeEnabled());

    await fillAndSubmit(user);
    expect(await screen.findByText("Ledger entry applied.")).toBeInTheDocument();
    expect(screen.queryByText("First failure")).not.toBeInTheDocument();
  });

  it("disables the button with a spinner while submitting and ignores double clicks", async () => {
    let finish!: (v: { success: boolean }) => void;
    apply.mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    const { container } = render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user);

    await waitFor(() => expect(field.submit()).toBeDisabled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    await user.click(field.submit());
    expect(apply).toHaveBeenCalledTimes(1);

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(field.submit()).toBeEnabled());
    expect(await screen.findByText("Ledger entry applied.")).toBeInTheDocument();
  });

  it("can submit again after a completed submission", async () => {
    const user = userEvent.setup();
    render(<LedgerConsole users={USERS} />);
    await fillAndSubmit(user);
    await screen.findByText("Ledger entry applied.");
    await waitFor(() => expect(field.user()).toHaveValue(""));

    await fillAndSubmit(user, "Second");
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
    expect(apply.mock.calls[1][0].get("note")).toBe("Second");
  });
});
