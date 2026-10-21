import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DepositForm } from "@/components/dashboard/DepositForm";
import { submitDeposit } from "@/lib/actions/deposits";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/deposits", () => ({ submitDeposit: vi.fn() }));

const submit = vi.mocked(submitDeposit);

const NO_FEE = { btcAddress: "bc1qexampleaddress", feePercent: 0, feeFlat: 0, minUsd: 10, maxUsd: 1_000_000 };
const WITH_FEE = { ...NO_FEE, feePercent: 10, feeFlat: 10 };

async function fill(user: ReturnType<typeof renderWithIntl>["user"], amount = "250.5", reference = "") {
  await user.type(screen.getByLabelText("Amount (USD)"), amount);
  if (reference) await user.type(screen.getByLabelText(/Transaction hash/), reference);
}

const submitButton = () => screen.getByRole("button", { name: "Deposit Confirm" });

describe("DepositForm", () => {
  it("renders the heading, intro and empty amount field", () => {
    renderWithIntl(<DepositForm {...NO_FEE} />);
    expect(screen.getByRole("heading", { name: "Deposit Bitcoin" })).toBeInTheDocument();
    expect(screen.getByText(/Enter how much you.d like to deposit/)).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    expect(screen.getByLabelText(/Transaction hash/)).toHaveValue("");
  });

  it("shows the Bitcoin address with a copy button", () => {
    renderWithIntl(<DepositForm {...NO_FEE} />);
    expect(screen.getByText("Bitcoin deposit address")).toBeInTheDocument();
    expect(screen.getByText("bc1qexampleaddress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();
  });

  it("shows a not-set-up message and no copy button when there is no address", () => {
    renderWithIntl(<DepositForm {...NO_FEE} btcAddress={null} />);
    expect(screen.getByText("Deposit details haven't been set up yet. Please contact support.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy/ })).not.toBeInTheDocument();
  });

  describe("QR code", () => {
    const QR = "data:image/png;base64,FAKE";

    it("shows the QR code image alongside the copyable address when one is provided", () => {
      renderWithIntl(<DepositForm {...NO_FEE} qrDataUrl={QR} />);
      const img = screen.getByAltText("QR code for the Bitcoin deposit address");
      expect(img).toHaveAttribute("src", QR);
      expect(screen.getByText("Or scan with your wallet app")).toBeInTheDocument();
      // Both options are available side by side: copy button and QR code.
      expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();
    });

    it("does not render a QR image when none is provided", () => {
      renderWithIntl(<DepositForm {...NO_FEE} />);
      expect(screen.queryByAltText("QR code for the Bitcoin deposit address")).not.toBeInTheDocument();
    });

    it("does not render a QR image when the address itself is missing, even if a QR url were given", () => {
      renderWithIntl(<DepositForm {...NO_FEE} btcAddress={null} qrDataUrl={QR} />);
      expect(screen.queryByAltText("QR code for the Bitcoin deposit address")).not.toBeInTheDocument();
    });
  });

  describe("pre-filled amount", () => {
    it("starts the amount field with the given initial amount", () => {
      renderWithIntl(<DepositForm {...NO_FEE} initialAmount={5000} />);
      expect(screen.getByLabelText("Amount (USD)")).toHaveValue(5000);
    });

    it("starts empty when no initial amount is given", () => {
      renderWithIntl(<DepositForm {...NO_FEE} />);
      expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    });

    it("still lets the user change the pre-filled amount", async () => {
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} initialAmount={5000} />);
      const amount = screen.getByLabelText("Amount (USD)");
      await user.clear(amount);
      await user.type(amount, "750");
      expect(amount).toHaveValue(750);
    });

    it("clears back to empty (not the initial amount) after a successful submission", async () => {
      submit.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} initialAmount={5000} />);
      await user.click(submitButton());
      await screen.findByText("Deposit submitted. It will show as pending until we verify it.");
      expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    });
  });

  it("does not offer a payment method field — deposits are Bitcoin-only", () => {
    renderWithIntl(<DepositForm {...NO_FEE} />);
    expect(screen.queryByLabelText(/method/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("constrains the amount input to the configured limits", () => {
    renderWithIntl(<DepositForm {...NO_FEE} minUsd={25} maxUsd={5000} />);
    const amount = screen.getByLabelText("Amount (USD)");
    expect(amount).toHaveAttribute("type", "number");
    expect(amount).toHaveAttribute("min", "25");
    expect(amount).toHaveAttribute("max", "5000");
    expect(amount).toHaveAttribute("step", "0.01");
    expect(amount).toBeRequired();
    expect(screen.getByLabelText(/Transaction hash/)).not.toBeRequired();
  });

  it("shows the configured limit range", () => {
    renderWithIntl(<DepositForm {...NO_FEE} minUsd={25} maxUsd={5000} />);
    expect(screen.getByText("$25.00 – $5,000.00")).toBeInTheDocument();
  });

  describe("live fee preview", () => {
    it("shows $0.00 fee and keeps total equal to amount with no fee configured", async () => {
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
      await user.type(screen.getByLabelText("Amount (USD)"), "1000");
      expect(screen.getByText("Processing charge").nextElementSibling).toHaveTextContent("$0.00");
      expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$1,000.00");
    });

    it("combines a flat and a percentage fee into the charge and total", async () => {
      const { user } = renderWithIntl(<DepositForm {...WITH_FEE} />);
      await user.type(screen.getByLabelText("Amount (USD)"), "1000");
      expect(screen.getByText("Processing charge").nextElementSibling).toHaveTextContent("$110.00");
      expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$1,110.00");
    });

    it("shows $0.00 everywhere before anything is typed", () => {
      renderWithIntl(<DepositForm {...WITH_FEE} />);
      expect(screen.getByText("Processing charge").nextElementSibling).toHaveTextContent("$0.00");
      expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$0.00");
    });

    it("recalculates as the amount changes", async () => {
      const { user } = renderWithIntl(<DepositForm {...WITH_FEE} />);
      const amount = screen.getByLabelText("Amount (USD)");
      await user.type(amount, "100");
      expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$120.00");
      await user.type(amount, "0");
      expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$1,110.00");
    });

    it("offers a tooltip explaining what the charge covers", () => {
      renderWithIntl(<DepositForm {...NO_FEE} />);
      expect(screen.getByTitle("Covers network and processing costs for Bitcoin deposits.")).toBeInTheDocument();
    });
  });

  describe("limit validation", () => {
    it("disables submit and shows nothing extra before the field is touched", () => {
      renderWithIntl(<DepositForm {...NO_FEE} minUsd={50} maxUsd={500} />);
      expect(submitButton()).toBeDisabled();
      expect(screen.queryByText(/Enter an amount between/)).not.toBeInTheDocument();
    });

    it("flags an amount below the minimum and disables submit", async () => {
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} minUsd={50} maxUsd={500} />);
      await user.type(screen.getByLabelText("Amount (USD)"), "10");
      expect(screen.getByText("Enter an amount between $50.00 and $500.00.")).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
    });

    it("flags an amount above the maximum and disables submit", async () => {
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} minUsd={50} maxUsd={500} />);
      await user.type(screen.getByLabelText("Amount (USD)"), "600");
      expect(screen.getByText("Enter an amount between $50.00 and $500.00.")).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
    });

    it("enables submit once the amount is within limits", async () => {
      const { user } = renderWithIntl(<DepositForm {...NO_FEE} minUsd={50} maxUsd={500} />);
      await user.type(screen.getByLabelText("Amount (USD)"), "100");
      expect(screen.queryByText(/Enter an amount between/)).not.toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
    });
  });

  it("does not call the action while the amount is empty", async () => {
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await user.click(submitButton());
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits the amount and reference as FormData", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user, "250.5", "0xabc123");
    await user.click(submitButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const data = submit.mock.calls[0][0];
    expect(data.get("amount")).toBe("250.5");
    expect(data.get("reference")).toBe("0xabc123");
  });

  it("submits an empty reference when none is given", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user, "10");
    await user.click(submitButton());
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].get("reference")).toBe("");
  });

  it("shows the success message and resets the form (amount, fee preview and reference) on success", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<DepositForm {...WITH_FEE} />);
    await fill(user, "99", "ref-1");
    await user.click(submitButton());

    expect(await screen.findByText("Deposit submitted. It will show as pending until we verify it.")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(null);
    expect(screen.getByLabelText(/Transaction hash/)).toHaveValue("");
    expect(screen.getByText("Total to send").nextElementSibling).toHaveTextContent("$0.00");
  });

  it("keeps the entered amount and reference after a server error", async () => {
    submit.mockResolvedValue({ error: "Enter the amount you deposited." });
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user, "120", "tx-abc");
    await user.click(submitButton());

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(120);
    expect(screen.getByLabelText(/Transaction hash/)).toHaveValue("tx-abc");
  });

  it("shows the server error as an alert", async () => {
    submit.mockResolvedValue({ error: "Enter the amount you deposited." });
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user, "50");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the amount you deposited.");
    expect(screen.queryByText(/Deposit submitted/)).not.toBeInTheDocument();
  });

  it("shows a loading state and disables the button while submitting", async () => {
    let resolve!: (v: { success: boolean }) => void;
    submit.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, container } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user);
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    resolve({ success: true });
    // Success clears the amount, so the button goes back to disabled (nothing to submit) rather than
    // enabled — assert the loading state ended via the spinner and success message instead.
    await screen.findByText("Deposit submitted. It will show as pending until we verify it.");
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("clears a previous error after a later success", async () => {
    submit.mockResolvedValueOnce({ error: "Nope" }).mockResolvedValueOnce({ success: true });
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} />);
    await fill(user);
    await user.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    // The values survive the failed attempt, so the user can simply resubmit.
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(250.5);
    await user.click(submitButton());
    expect(await screen.findByText(/Deposit submitted/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is translated to French", () => {
    renderWithIntl(<DepositForm {...NO_FEE} />, { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Déposer du Bitcoin" })).toBeInTheDocument();
    expect(screen.getByLabelText("Montant (USD)")).toBeInTheDocument();
    expect(screen.getByText("Adresse de dépôt Bitcoin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer le dépôt" })).toBeInTheDocument();
  });

  it("is translated to Chinese, including the fee labels and success message", async () => {
    submit.mockResolvedValue({ success: true });
    const { user } = renderWithIntl(<DepositForm {...WITH_FEE} />, { locale: "zh" });
    expect(screen.getByLabelText("金额（USD）")).toBeInTheDocument();
    await user.type(screen.getByLabelText("金额（USD）"), "1000");
    expect(screen.getByText("手续费").nextElementSibling).toHaveTextContent("$110.00");
    await user.click(screen.getByRole("button", { name: "确认存款" }));
    expect(await screen.findByText("存款已提交。在我们核实之前将显示为待处理。")).toBeInTheDocument();
  });

  it("reports the outside-limits error in French", async () => {
    const { user } = renderWithIntl(<DepositForm {...NO_FEE} minUsd={50} maxUsd={500} />, { locale: "fr" });
    await user.type(screen.getByLabelText("Montant (USD)"), "10");
    expect(screen.getByText("Saisissez un montant compris entre $50.00 et $500.00.")).toBeInTheDocument();
  });
});
