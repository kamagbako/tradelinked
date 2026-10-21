import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

// Simulate a deployment where the browser cannot build a Supabase client (missing/invalid public env vars).
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    throw new Error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL");
  },
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn(), logWarn: vi.fn() }));

import { SidebarBalance } from "@/components/dashboard/SidebarBalance";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";

describe("live-update components with a broken Supabase configuration", () => {
  it("SidebarBalance still shows the server-provided balance", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={1250.5} />);
    expect(screen.getByText("1,250.50")).toBeInTheDocument();
  });

  it("the compact SidebarBalance chip still renders", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={10} compact />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
  });

  it("TransactionsTable still renders its (server-provided) rows", () => {
    renderWithIntl(<TransactionsTable userId="u1" deposits={[]} withdrawals={[]} ledger={[]} />);
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
  });
});
