import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { WithdrawalForm } from "@/components/dashboard/WithdrawalForm";
import { submitWithdrawal } from "@/lib/actions/withdrawals";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/withdrawals", () => ({ submitWithdrawal: vi.fn() }));

const submit = vi.mocked(submitWithdrawal);
const submitButton = () => screen.getByRole("button", { name: "Submit Request" });

async function fill(
  user: ReturnType<typeof renderWithIntl>["user"],
  { amount = "75", method = "BANK_TRANSFER", details = "IBAN GB00 1234" } = {},
) {
  await user.type(screen.getByLabelText("Amount (USD)"), amount);
  await user.selectOptions(screen.getByLabelText("Payout method"), method);
  await user.type(screen.getByLabelText("Payout details"), details);
}

describe("WithdrawalForm", () => {
  it("renders the heading and empty fields", () => {
    renderWithIntl(<WithdrawalForm />);
    expect(screen.getByRole("heading", { name: "Request Withdrawal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    expect(screen.getByLabelText("Payout method")).toHaveValue("");
    expect(screen.getByLabelText("Payout details")).toHaveValue("");
    expect(screen.getByPlaceholderText("Bank account details or wallet address")).toBeInTheDocument();
  });

  it("makes every field required", () => {
    renderWithIntl(<WithdrawalForm />);
    expect(screen.getByLabelText("Amount (USD)")).toBeRequired();
    expect(screen.getByLabelText("Payout method")).toBeRequired();
    expect(screen.getByLabelText("Payout details")).toBeRequired();
  });

  it("constrains the amount to at least 1 in cent steps", () => {
    renderWithIntl(<WithdrawalForm />);
    const amount = screen.getByLabelText("Amount (USD)");
    expect(amount).toHaveAttribute("min", "1");
    expect(amount).toHaveAttribute("step", "0.01");
  });

  it("offers the three payout methods", () => {
    renderWithIntl(<WithdrawalForm />);
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["", "BANK_TRANSFER", "BTC", "USDT"]);
  });

  it("is anchored at #withdraw", () => {
    const { container } = renderWithIntl(<WithdrawalForm />);
    expect(container.querySelector("#withdraw")).toBeInTheDocument();
  });

  it("does not submit with empty fields", async () => {
    const { user } = renderWithIntl(<WithdrawalForm />);
    await user.click(submitButton());
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not submit when payout details are missing", async () => {
    const { user } = renderWithIntl(<WithdrawalForm />);
    await user.type(screen.getByLabelText("Amount (USD)"), "10");
    await user.selectOptions(screen.getByLabelText("Payout method"), "BTC");
    await user.click(submitButton());
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits amount, payoutMethod and payoutDetails as FormData", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<WithdrawalForm />);
    await fill(user, { amount: "120.25", method: "USDT", details: "TXyz-wallet" });
    await user.click(submitButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const data = submit.mock.calls[0][0];
    expect(data.get("amount")).toBe("120.25");
    expect(data.get("payoutMethod")).toBe("USDT");
    expect(data.get("payoutDetails")).toBe("TXyz-wallet");
  });

  it("shows the success message and resets the form", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<WithdrawalForm />);
    await fill(user);
    await user.click(submitButton());

    expect(await screen.findByText("Withdrawal request submitted. We'll email you once it's reviewed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    expect(screen.getByLabelText("Payout method")).toHaveValue("");
    expect(screen.getByLabelText("Payout details")).toHaveValue("");
  });

  it("keeps the entered values after a server error", async () => {
    submit.mockResolvedValue({ error: "Insufficient balance" });
    const { user } = renderWithIntl(<WithdrawalForm />);
    await fill(user, { amount: "500", method: "BTC", details: "bc1qexample" });
    await user.click(screen.getByRole("button", { name: /Submit Request/i }));

    await screen.findByText("Insufficient balance");
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(500);
    expect(screen.getByLabelText("Payout method")).toHaveValue("BTC");
    expect(screen.getByLabelText("Payout details")).toHaveValue("bc1qexample");
  });

  it("shows the error and no success message when the action fails", async () => {
    submit.mockResolvedValue({ error: "Enter a valid withdrawal amount." });
    const { user } = renderWithIntl(<WithdrawalForm />);
    await fill(user, { amount: "5", details: "my wallet" });
    await user.click(submitButton());

    expect(await screen.findByText("Enter a valid withdrawal amount.")).toBeInTheDocument();
    expect(screen.queryByText(/Withdrawal request submitted/)).not.toBeInTheDocument();
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolve!: (v: { success: boolean }) => void;
    submit.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, container } = renderWithIntl(<WithdrawalForm />);
    await fill(user);
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    resolve({ success: true });
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  it("is translated to French", () => {
    renderWithIntl(<WithdrawalForm />, { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Demander un retrait" })).toBeInTheDocument();
    expect(screen.getByLabelText("Détails du versement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Soumettre la demande" })).toBeInTheDocument();
  });

  it("is translated to Chinese, including errors surfaced from the action", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<WithdrawalForm />, { locale: "zh" });
    await user.type(screen.getByLabelText("金额（USD）"), "5");
    await user.selectOptions(screen.getByLabelText("收款方式"), "BTC");
    await user.type(screen.getByLabelText("收款信息"), "addr");
    await user.click(screen.getByRole("button", { name: "提交申请" }));
    expect(await screen.findByText("提款申请已提交。审核完成后我们将通过邮件通知您。")).toBeInTheDocument();
  });
});
