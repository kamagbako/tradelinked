import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <Skeleton className="h-[420px] w-full rounded-2xl sm:h-[520px]" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
