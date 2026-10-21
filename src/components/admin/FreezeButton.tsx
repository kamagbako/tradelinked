"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { toggleUserFreeze } from "@/lib/actions/settings";

export function FreezeButton({ userId, isFrozen }: { userId: string; isFrozen: boolean }) {
  const [frozen, setFrozen] = useState(isFrozen);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !frozen;
    startTransition(async () => {
      const result = await toggleUserFreeze(userId, next);
      if (!result.error) setFrozen(next);
    });
  }

  return (
    <Button
      size="sm"
      variant={frozen ? "success" : "danger"}
      isLoading={isPending}
      onClick={handleClick}
    >
      {frozen ? "Unfreeze" : "Freeze"}
    </Button>
  );
}
