import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

export const Tabs = RadixTabs.Root;

export function TabsList({
  className,
  ...props
}: RadixTabs.TabsListProps & { className?: string }) {
  return (
    <RadixTabs.List
      className={cn(
        "inline-flex items-center gap-0.5",
        "bg-[var(--bg-alt)] border border-[var(--border)] rounded-[var(--radius-md)] p-1",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: RadixTabs.TabsTriggerProps & { className?: string }) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        "rounded-[var(--radius-sm)] px-3.5 h-8",
        "text-[13px] font-medium text-[var(--text-muted)]",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-sm",
        "hover:text-[var(--text-primary)]",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: RadixTabs.TabsContentProps & { className?: string }) {
  return (
    <RadixTabs.Content
      className={cn(
        "mt-4 focus-visible:outline-none",
        "data-[state=inactive]:hidden",
        className
      )}
      {...props}
    />
  );
}
