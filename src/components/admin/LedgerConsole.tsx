"use client";

import { useActionState, useRef, useTransition, type FormEvent } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { applyLedgerEntry, type ActionResult } from "@/lib/actions/ledger";

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
}

export function LedgerConsole({ users, defaultUserId }: { users: UserOption[]; defaultUserId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      // Guards against a double-click firing two overlapping submissions
      // before React re-renders the disabled button state.
      if (submittingRef.current) return _prev;
      submittingRef.current = true;
      try {
        const result = await applyLedgerEntry(formData);
        if (result.success) formRef.current?.reset();
        return result;
      } finally {
        submittingRef.current = false;
      }
    },
    {},
  );
  const [, startTransition] = useTransition();

  // Submit through onSubmit so React 19 doesn't reset the fields after an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <GlassCard className="max-w-lg">
      <h2 className="mb-4 text-base font-semibold text-text">Manual Ledger Entry</h2>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="userId">User</Label>
          <Select id="userId" name="userId" required defaultValue={defaultUserId ?? ""}>
            <option value="" disabled>Select a user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ? `${user.full_name} — ${user.email}` : user.email}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="type">Entry type</Label>
          <Select id="type" name="type" required defaultValue="">
            <option value="" disabled>Select a type</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
            <option value="PROFIT_YIELD">Profit Yield</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount (USD)</Label>
          <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
        </div>

        <div>
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" name="note" placeholder="Reason for this adjustment" />
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-400">Ledger entry applied.</p>}

        <Button type="submit" isLoading={isPending} className="w-full">
          Apply Entry
        </Button>
      </form>
    </GlassCard>
  );
}
