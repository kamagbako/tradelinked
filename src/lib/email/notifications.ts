import "server-only";
import type { ReactElement } from "react";
import { ADMIN_EMAIL, EMAIL_FROM, getResend } from "./resend";
import { WithdrawalRequestedEmail } from "./templates/WithdrawalRequested";
import { WithdrawalApprovedEmail } from "./templates/WithdrawalApproved";
import { WithdrawalRejectedEmail } from "./templates/WithdrawalRejected";
import { DepositApprovedEmail } from "./templates/DepositApproved";
import { DepositRejectedEmail } from "./templates/DepositRejected";
import { LowBalanceEmail } from "./templates/LowBalance";
import { formatCurrency } from "@/lib/utils";
import { logError, logWarn } from "@/lib/logger";

/**
 * Notification emails are best-effort: the money movement they describe has already happened, so a
 * missing API key or a provider outage is logged and swallowed rather than failing the user's action.
 */
async function send(to: string, subject: string, react: ReactElement) {
  const resend = getResend();
  if (!resend) {
    logWarn("email", "RESEND_API_KEY is not set; skipping email.", { subject });
    return;
  }

  try {
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, react });
    if (error) logError("email", new Error(error.message), { subject });
  } catch (error) {
    logError("email", error, { subject });
  }
}

interface WithdrawalRequestedParams {
  userEmail: string;
  amount: number;
  payoutMethod: string;
}

export async function sendWithdrawalRequestedEmail({ userEmail, amount, payoutMethod }: WithdrawalRequestedParams) {
  const amountLabel = formatCurrency(amount);

  await Promise.all([
    send(
      userEmail,
      "Withdrawal request received",
      WithdrawalRequestedEmail({ amount: amountLabel, payoutMethod, userEmail }),
    ),
    ADMIN_EMAIL
      ? send(
          ADMIN_EMAIL,
          `New withdrawal request from ${userEmail}`,
          WithdrawalRequestedEmail({ amount: amountLabel, payoutMethod, userEmail, isAdminCopy: true }),
        )
      : Promise.resolve(),
  ]);
}

interface WithdrawalApprovedParams {
  userEmail: string;
  amount: number;
  payoutMethod: string;
  note?: string | null;
}

export async function sendWithdrawalApprovedEmail({ userEmail, amount, payoutMethod, note }: WithdrawalApprovedParams) {
  await send(
    userEmail,
    "Your withdrawal has been approved",
    WithdrawalApprovedEmail({ amount: formatCurrency(amount), payoutMethod, note }),
  );
}

interface WithdrawalRejectedParams {
  userEmail: string;
  amount: number;
  reason: string;
  supportUrl: string;
}

export async function sendWithdrawalRejectedEmail({ userEmail, amount, reason, supportUrl }: WithdrawalRejectedParams) {
  await send(
    userEmail,
    "Your withdrawal request was rejected",
    WithdrawalRejectedEmail({ amount: formatCurrency(amount), reason, supportUrl }),
  );
}

interface DepositApprovedParams {
  userEmail: string;
  amount: number;
}

export async function sendDepositApprovedEmail({ userEmail, amount }: DepositApprovedParams) {
  await send(userEmail, "Deposit approved", DepositApprovedEmail({ amount: formatCurrency(amount) }));
}

interface DepositRejectedParams {
  userEmail: string;
  amount: number;
  reason: string;
  supportUrl: string;
}

export async function sendDepositRejectedEmail({ userEmail, amount, reason, supportUrl }: DepositRejectedParams) {
  await send(
    userEmail,
    "Deposit rejected",
    DepositRejectedEmail({ amount: formatCurrency(amount), reason, supportUrl }),
  );
}

interface LowBalanceParams {
  userEmail: string;
  balance: number;
  threshold: number;
}

export async function sendLowBalanceEmail({ userEmail, balance, threshold }: LowBalanceParams) {
  await send(
    userEmail,
    "Your balance is low",
    LowBalanceEmail({ balance: formatCurrency(balance), threshold: formatCurrency(threshold) }),
  );
}
