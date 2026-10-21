import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Shown as the mobile card's title row when true. */
  primary?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
}

export function ResponsiveTable<T>({ columns, rows, rowKey, emptyState }: ResponsiveTableProps<T>) {
  const t = useTranslations("common");

  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-sm text-text-muted">
        {emptyState ?? t("noRecords")}
      </div>
    );
  }

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const secondaryColumns = columns.filter((c) => c !== primaryColumn);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-text-muted">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-hover/40">
                {columns.map((col) => (
                  <td key={col.key} className={col.className ?? "px-4 py-3 text-text"}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="glass-card rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-text-muted">
                {primaryColumn.header}
              </span>
              <span className="font-semibold text-text">{primaryColumn.render(row)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {secondaryColumns.map((col) => (
                <div key={col.key} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{col.header}</span>
                  <span className="text-text">{col.render(row)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
