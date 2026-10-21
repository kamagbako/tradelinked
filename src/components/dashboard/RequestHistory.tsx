"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface RequestRow {
  id: string;
  amount: number;
  method: string;
  status: string;
  detail: string | null;
  created_at: string;
}

const tone: Record<string, "success" | "warning" | "danger"> = {
  APPROVED: "success",
  COMPLETED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

export function RequestHistory({ rows, empty }: { rows: RequestRow[]; empty: string }) {
  const t = useTranslations("dashboard");

  const columns: ResponsiveColumn<RequestRow>[] = [
    { key: "amount", header: t("requestHistory.columns.amount"), primary: true, render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: "method", header: t("requestHistory.columns.method"), render: (r) => (t.has(`methods.${r.method}`) ? t(`methods.${r.method}`) : r.method.replace("_", " ")) },
    { key: "status", header: t("requestHistory.columns.status"), render: (r) => <Badge tone={tone[r.status] ?? "neutral"}>{t.has(`statuses.${r.status}`) ? t(`statuses.${r.status}`) : r.status}</Badge> },
    { key: "detail", header: t("requestHistory.columns.details"), render: (r) => <span className="line-clamp-1 max-w-[16rem]">{r.detail || "—"}</span> },
    { key: "created_at", header: t("requestHistory.columns.date"), render: (r) => formatDate(r.created_at) },
  ];

  return <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyState={empty} />;
}
