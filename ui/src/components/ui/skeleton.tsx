import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

export function Skeleton({ className, width, height, rounded = "md" }: SkeletonProps) {
  const roundedMap = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };
  return (
    <div
      className={cn(
        "skeleton-shimmer",
        roundedMap[rounded],
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          className={i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width={32} height={32} rounded="lg" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton height={12} className="w-2/3" />
          <Skeleton height={10} className="w-1/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 px-3 py-2.5 border-b border-[var(--border)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-3 border-b border-[var(--border-subtle)]">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={12} className={j === 0 ? "flex-1 w-1/3" : "flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}
