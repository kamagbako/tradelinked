export type UserRole = "USER" | "ADMIN";

export type LedgerEntryType = "CREDIT" | "DEBIT" | "PROFIT_YIELD";

export type WithdrawalStatus = "PENDING" | "COMPLETED" | "REJECTED";

export type PayoutMethod = "BANK_TRANSFER" | "BTC" | "USDT";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_frozen: boolean;
  active_plan: string | null;
  phone: string | null;
  country: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  zip_code: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
}

export interface Balance {
  user_id: string;
  available_balance: number;
  total_profit: number;
  total_deposited: number;
  updated_at: string;
  low_balance_notified_at: string | null;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  type: LedgerEntryType;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  payout_method: PayoutMethod;
  payout_details: string;
  status: WithdrawalStatus;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  profiles?: { email: string; full_name: string | null };
}

export type DepositStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  method: PayoutMethod;
  reference: string | null;
  status: DepositStatus;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles?: { email: string; full_name: string | null };
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  btc_address: string | null;
  usdt_address: string | null;
  whatsapp_support_url: string | null;
  /** Percentage processing fee applied to Bitcoin deposits, e.g. 2.5 for 2.5%. */
  deposit_fee_percent: number;
  /** Flat processing fee (USD) added on top of the percentage. */
  deposit_fee_flat: number;
  deposit_min_usd: number;
  deposit_max_usd: number;
  /** A user's available balance falling below this triggers the low-balance email. 0 disables it. */
  low_balance_threshold_usd: number;
  updated_at: string;
}

export type MessageSender = "ADMIN" | "USER";

export interface Message {
  id: string;
  user_id: string;
  sender: MessageSender;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface InvestmentPlan {
  /** Also the translation key under `landing.plans.items.<id>` (name, features.<key>). */
  id: string;
  minDeposit: number;
  maxDeposit: number;
  roiPercent: number;
  durationDays: number;
  /** Translation keys under `landing.plans.items.<id>.features`. */
  features: string[];
  featured?: boolean;
}
