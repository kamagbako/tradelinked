import Link from "next/link";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FreezeButton } from "@/components/admin/FreezeButton";
import { MessageUserButton } from "@/components/admin/MessageUserButton";
import { formatCurrency } from "@/lib/utils";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_frozen: boolean;
  available_balance: number;
  unread_messages: number;
}

const columns: ResponsiveColumn<AdminUserRow>[] = [
  {
    key: "name",
    header: "User",
    primary: true,
    render: (row) => (
      <div>
        <p className="font-medium text-text">{row.full_name || "—"}</p>
        <p className="text-xs text-text-muted">{row.email}</p>
      </div>
    ),
  },
  {
    key: "balance",
    header: "Balance",
    render: (row) => formatCurrency(row.available_balance),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge tone={row.is_frozen ? "danger" : "success"}>{row.is_frozen ? "Frozen" : "Active"}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    render: (row) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/ledger?userId=${row.id}`}>
          <Button size="sm" variant="secondary">Adjust Balance</Button>
        </Link>
        <MessageUserButton userId={row.id} label={row.full_name || row.email} initialUnread={row.unread_messages} />
        <FreezeButton userId={row.id} isFrozen={row.is_frozen} />
      </div>
    ),
  },
];

export function UserTable({ rows }: { rows: AdminUserRow[] }) {
  return (
    <ResponsiveTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyState="No users found." />
  );
}
