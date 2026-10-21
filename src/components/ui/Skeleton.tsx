import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-hover", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
  );
}
