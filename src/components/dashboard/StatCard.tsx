import { GlassCard } from "@/components/ui/GlassCard";

interface StatCardProps {
  title: string;
  value: string;
  columns: { label: string; value: string }[];
  footer: string;
  accent?: string;
}

/** Headline figure, a row of sub-figures, and a plain-English summary line. */
export function StatCard({ title, value, columns, footer, accent = "border-l-blue-500" }: StatCardProps) {
  return (
    <GlassCard className={`h-full border-l-4 ${accent} p-6`}>
      <h2 className="text-lg font-semibold text-text-muted">{title}</h2>
      <p className="mt-5 text-3xl font-bold text-text">{value}</p>

      <div className="mt-6 grid grid-cols-3 gap-3 border-b border-border pb-5">
        {columns.map((col) => (
          <div key={col.label}>
            <p className="text-sm font-semibold text-text">{col.label}</p>
            <p className="mt-1 text-xs text-text-muted">{col.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs italic leading-relaxed text-text-muted">{footer}</p>
    </GlassCard>
  );
}
