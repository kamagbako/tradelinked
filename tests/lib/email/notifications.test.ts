import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, logErrorMock, logWarnMock, ResendMock } = vi.hoisted(() => {
  const send = vi.fn();
  return {
    sendMock: send,
    ResendMock: vi.fn(function (this: { emails: { send: typeof send } }) {
      this.emails = { send };
    }),
    logErrorMock: vi.fn(),
    logWarnMock: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: logWarnMock }));
vi.mock("resend", () => ({ Resend: ResendMock }));

type ElementProps = { previewText: string; heading: string; children: unknown };

async function load(adminEmail = "", apiKey: string | null = "re_test_key") {
  vi.resetModules();
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", adminEmail);
  vi.stubEnv("RESEND_API_KEY", apiKey ?? "");
  delete process.env.RESEND_FROM_EMAIL;
  return import("@/lib/email/notifications");
}

function propsOf(call: number) {
  const payload = sendMock.mock.calls[call][0] as { react: ReactElement<ElementProps> };
  return payload.react.props;
}

beforeEach(() => {
  sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendWithdrawalRequestedEmail", () => {
  const params = { userEmail: "user@example.com", amount: 1234.5, payoutMethod: "BTC" };

  it("sends one email to the user when no admin email is configured", async () => {
    const { sendWithdrawalRequestedEmail } = await load("");
    await sendWithdrawalRequestedEmail(params);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: "TradeLinked <notifications@tradelinked.app>",
      to: "user@example.com",
      subject: "Withdrawal request received",
      react: expect.anything(),
    });
  });

  it("formats the amount as currency in the template", async () => {
    const { sendWithdrawalRequestedEmail } = await load("");
    await sendWithdrawalRequestedEmail(params);
    expect(propsOf(0).previewText).toBe("Withdrawal request of $1,234.50 submitted");
    expect(propsOf(0).heading).toBe("Withdrawal request received");
  });

  it("also sends an admin copy when ADMIN_NOTIFICATION_EMAIL is set", async () => {
    const { sendWithdrawalRequestedEmail } = await load("admin@example.com");
    await sendWithdrawalRequestedEmail(params);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const recipients = sendMock.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(recipients).toEqual(["admin@example.com", "user@example.com"]);
    const adminCall = sendMock.mock.calls.findIndex((c) => (c[0] as { to: string }).to === "admin@example.com");
    expect(sendMock.mock.calls[adminCall][0]).toMatchObject({ subject: "New withdrawal request from user@example.com" });
    expect(propsOf(adminCall).heading).toBe("New withdrawal request");
  });

  it("logs a warning and skips when RESEND_API_KEY is missing", async () => {
    const { sendWithdrawalRequestedEmail } = await load("admin@example.com", null);
    await expect(sendWithdrawalRequestedEmail(params)).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledTimes(2);
    expect(logWarnMock).toHaveBeenCalledWith("email", "RESEND_API_KEY is not set; skipping email.", {
      subject: "Withdrawal request received",
    });
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("logs and swallows a provider {error} result", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    const { sendWithdrawalRequestedEmail } = await load("");
    await expect(sendWithdrawalRequestedEmail(params)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [scope, err, ctx] = logErrorMock.mock.calls[0];
    expect(scope).toBe("email");
    expect((err as Error).message).toBe("domain not verified");
    expect(ctx).toEqual({ subject: "Withdrawal request received" });
  });

  it("logs and swallows a thrown error", async () => {
    const boom = new Error("socket hang up");
    sendMock.mockRejectedValue(boom);
    const { sendWithdrawalRequestedEmail } = await load("");
    await expect(sendWithdrawalRequestedEmail(params)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith("email", boom, { subject: "Withdrawal request received" });
  });

  it("a failure sending the user's email does not stop the admin copy", async () => {
    sendMock.mockRejectedValueOnce(new Error("first fails"));
    const { sendWithdrawalRequestedEmail } = await load("admin@example.com");
    await expect(sendWithdrawalRequestedEmail(params)).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendWithdrawalApprovedEmail", () => {
  it("sends the approval email to the user only, even when an admin email is set", async () => {
    const { sendWithdrawalApprovedEmail } = await load("admin@example.com");
    await sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 50, payoutMethod: "USDT" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u@example.com", subject: "Your withdrawal has been approved" }),
    );
    expect(propsOf(0).previewText).toBe("Your withdrawal of $50.00 was approved");
  });

  it("includes the note in the template when given", async () => {
    const { sendWithdrawalApprovedEmail } = await load("");
    await sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 1, payoutMethod: "BTC", note: "Sent via node" });
    expect(JSON.stringify(propsOf(0).children)).toContain("Sent via node");
  });

  it("omits the note section when there is none", async () => {
    const { sendWithdrawalApprovedEmail } = await load("");
    await sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 1, payoutMethod: "BTC", note: null });
    expect(JSON.stringify(propsOf(0).children)).not.toContain("Note");
  });

  it("skips with a warning when email is not configured", async () => {
    const { sendWithdrawalApprovedEmail } = await load("", null);
    await sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 1, payoutMethod: "BTC" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith("email", expect.stringContaining("RESEND_API_KEY"), {
      subject: "Your withdrawal has been approved",
    });
  });

  it("never propagates provider errors", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const { sendWithdrawalApprovedEmail } = await load("");
    await expect(
      sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 1, payoutMethod: "BTC" }),
    ).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("never propagates thrown errors", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const { sendWithdrawalApprovedEmail } = await load("");
    await expect(
      sendWithdrawalApprovedEmail({ userEmail: "u@example.com", amount: 1, payoutMethod: "BTC" }),
    ).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendWithdrawalRejectedEmail", () => {
  const params = { userEmail: "u@example.com", amount: 99.99, reason: "Invalid address", supportUrl: "https://wa.me/1" };

  it("sends the rejection email with reason and support URL", async () => {
    const { sendWithdrawalRejectedEmail } = await load("admin@example.com");
    await sendWithdrawalRejectedEmail(params);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u@example.com", subject: "Your withdrawal request was rejected" }),
    );
    expect(propsOf(0).previewText).toBe("Your withdrawal of $99.99 was rejected");
    const body = JSON.stringify(propsOf(0).children);
    expect(body).toContain("Invalid address");
    expect(body).toContain("https://wa.me/1");
  });

  it("skips with a warning when email is not configured", async () => {
    const { sendWithdrawalRejectedEmail } = await load("", null);
    await expect(sendWithdrawalRejectedEmail(params)).resolves.toBeUndefined();
    expect(logWarnMock).toHaveBeenCalledTimes(1);
  });

  it("logs the provider error and resolves", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "bad request" } });
    const { sendWithdrawalRejectedEmail } = await load("");
    await expect(sendWithdrawalRejectedEmail(params)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith("email", expect.objectContaining({ message: "bad request" }), {
      subject: "Your withdrawal request was rejected",
    });
  });

  it("logs a thrown error and resolves", async () => {
    sendMock.mockRejectedValue(new Error("offline"));
    const { sendWithdrawalRejectedEmail } = await load("");
    await expect(sendWithdrawalRejectedEmail(params)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendDepositApprovedEmail", () => {
  it("sends the approval email with the formatted amount", async () => {
    const { sendDepositApprovedEmail } = await load("admin@example.com");
    await sendDepositApprovedEmail({ userEmail: "u@example.com", amount: 1234.5 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u@example.com", subject: "Deposit approved" }),
    );
    expect(propsOf(0).previewText).toBe("Your deposit of $1,234.50 was approved");
  });

  it("skips with a warning when email is not configured", async () => {
    const { sendDepositApprovedEmail } = await load("", null);
    await sendDepositApprovedEmail({ userEmail: "u@example.com", amount: 1 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith("email", expect.stringContaining("RESEND_API_KEY"), {
      subject: "Deposit approved",
    });
  });

  it("never propagates provider errors or thrown errors", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });
    const { sendDepositApprovedEmail } = await load("");
    await expect(sendDepositApprovedEmail({ userEmail: "u@example.com", amount: 1 })).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendDepositRejectedEmail", () => {
  const params = { userEmail: "u@example.com", amount: 99.99, reason: "No matching transfer", supportUrl: "https://wa.me/1" };

  it("sends the rejection email with reason and support url", async () => {
    const { sendDepositRejectedEmail } = await load("admin@example.com");
    await sendDepositRejectedEmail(params);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "u@example.com", subject: "Deposit rejected" }));
    expect(propsOf(0).previewText).toBe("Your deposit of $99.99 was rejected");
    const body = JSON.stringify(propsOf(0).children);
    expect(body).toContain("No matching transfer");
    expect(body).toContain("https://wa.me/1");
  });

  it("skips with a warning when email is not configured", async () => {
    const { sendDepositRejectedEmail } = await load("", null);
    await expect(sendDepositRejectedEmail(params)).resolves.toBeUndefined();
    expect(logWarnMock).toHaveBeenCalledTimes(1);
  });

  it("logs a thrown error and resolves", async () => {
    sendMock.mockRejectedValue(new Error("offline"));
    const { sendDepositRejectedEmail } = await load("");
    await expect(sendDepositRejectedEmail(params)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendLowBalanceEmail", () => {
  it("sends the alert with the formatted balance and threshold", async () => {
    const { sendLowBalanceEmail } = await load("admin@example.com");
    await sendLowBalanceEmail({ userEmail: "u@example.com", balance: 12.5, threshold: 50 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u@example.com", subject: "Your balance is low" }),
    );
    expect(propsOf(0).previewText).toBe("Your balance has dropped below $50.00");
    const body = JSON.stringify(propsOf(0).children);
    expect(body).toContain("$12.50");
    expect(body).toContain("$50.00");
  });

  it("skips with a warning when email is not configured", async () => {
    const { sendLowBalanceEmail } = await load("", null);
    await sendLowBalanceEmail({ userEmail: "u@example.com", balance: 1, threshold: 50 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith("email", expect.stringContaining("RESEND_API_KEY"), {
      subject: "Your balance is low",
    });
  });

  it("never propagates provider errors or thrown errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const { sendLowBalanceEmail } = await load("");
    await expect(sendLowBalanceEmail({ userEmail: "u@example.com", balance: 1, threshold: 50 })).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
