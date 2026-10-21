"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MobileDrawer } from "@/components/ui/MobileDrawer";
import { Label, Textarea } from "@/components/ui/Input";
import { resolveDeposit } from "@/lib/actions/deposits";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Deposit } from "@/lib/types";

export function DepositQueue({ initialDeposits }: { initialDeposits: Deposit[] }) {
  const [deposits, setDeposits] = useState(initialDeposits);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function approve(deposit: Deposit) {
    if (isPending) return;
    setPendingId(deposit.id);
    startTransition(async () => {
      const result = await resolveDeposit(deposit.id, "APPROVED");
      setError(result.error ?? null);
      if (!result.error) {
        setDeposits((prev) => prev.filter((w) => w.id !== deposit.id));
      }
      setPendingId(null);
    });
  }

  function submitRejection() {
    if (!rejectTarget || isPending) return;
    const target = rejectTarget;
    setPendingId(target.id);
    startTransition(async () => {
      const result = await resolveDeposit(target.id, "REJECTED", reason);
      setError(result.error ?? null);
      if (!result.error) {
        setDeposits((prev) => prev.filter((w) => w.id !== target.id));
        setRejectTarget(null);
        setReason("");
      }
      setPendingId(null);
    });
  }

  if (deposits.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-sm text-text-muted">
        No pending deposits.
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
        {deposits.map((deposit) => (
          <div key={deposit.id} className="glass-card flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-text">{formatCurrency(deposit.amount)}</p>
                <Badge tone="warning">{deposit.method.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {deposit.profiles?.full_name || deposit.profiles?.email}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{formatDate(deposit.created_at)}</p>
              <p className="mt-2 max-w-md truncate text-xs text-text-muted">
                Reference: {deposit.reference || "none given"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="success"
                isLoading={isPending && pendingId === deposit.id}
                onClick={() => approve(deposit)}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isPending}
                onClick={() => setRejectTarget(deposit)}
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
        title="Reject Deposit"
      >
        <p className="mb-4 text-sm text-text-muted">
          The {rejectTarget ? formatCurrency(rejectTarget.amount) : ""} deposit will be marked as rejected and
          nothing will be credited to the user.
        </p>
        <Label htmlFor="reason">Rejection reason</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this deposit is being rejected (shown to the user)"
        />
        <Button className="mt-4 w-full" variant="danger" isLoading={isPending} onClick={submitRejection}>
          Confirm Rejection
        </Button>
      </MobileDrawer>
    </>
  );
}
