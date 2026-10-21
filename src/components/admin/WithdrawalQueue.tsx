"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MobileDrawer } from "@/components/ui/MobileDrawer";
import { Label, Textarea } from "@/components/ui/Input";
import { resolveWithdrawal } from "@/lib/actions/withdrawals";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Withdrawal } from "@/lib/types";

export function WithdrawalQueue({ initialWithdrawals }: { initialWithdrawals: Withdrawal[] }) {
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function approve(withdrawal: Withdrawal) {
    if (isPending) return;
    setPendingId(withdrawal.id);
    startTransition(async () => {
      const result = await resolveWithdrawal(withdrawal.id, "COMPLETED");
      setError(result.error ?? null);
      if (!result.error) {
        setWithdrawals((prev) => prev.filter((w) => w.id !== withdrawal.id));
      }
      setPendingId(null);
    });
  }

  function submitRejection() {
    if (!rejectTarget || isPending) return;
    const target = rejectTarget;
    setPendingId(target.id);
    startTransition(async () => {
      const result = await resolveWithdrawal(target.id, "REJECTED", reason);
      setError(result.error ?? null);
      if (!result.error) {
        setWithdrawals((prev) => prev.filter((w) => w.id !== target.id));
        setRejectTarget(null);
        setReason("");
      }
      setPendingId(null);
    });
  }

  if (withdrawals.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-sm text-text-muted">
        No pending withdrawals.
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {withdrawals.map((withdrawal) => (
          <div key={withdrawal.id} className="glass-card flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-text">{formatCurrency(withdrawal.amount)}</p>
                <Badge tone="warning">{withdrawal.payout_method.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {withdrawal.profiles?.full_name || withdrawal.profiles?.email}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{formatDate(withdrawal.created_at)}</p>
              <p className="mt-2 max-w-md truncate text-xs text-text-muted">
                Payout details: {withdrawal.payout_details}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="success"
                isLoading={isPending && pendingId === withdrawal.id}
                onClick={() => approve(withdrawal)}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isPending}
                onClick={() => setRejectTarget(withdrawal)}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <MobileDrawer
        open={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null);
          setReason("");
        }}
        title="Reject Withdrawal"
      >
        <p className="mb-4 text-sm text-text-muted">
          This will refund {rejectTarget ? formatCurrency(rejectTarget.amount) : ""} back to the
          user&apos;s available balance and notify them by email.
        </p>
        <Label htmlFor="reason">Rejection reason</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this withdrawal is being rejected"
        />
        <Button className="mt-4 w-full" variant="danger" isLoading={isPending} onClick={submitRejection}>
          Confirm Rejection
        </Button>
      </MobileDrawer>
    </>
  );
}
