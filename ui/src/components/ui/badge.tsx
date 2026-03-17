import React from "react";
import { cn } from "../../lib/utils";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "muted"
  | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "sm" | "md";
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--surface-raised)] text-[var(--text-secondary)]",
  primary: "bg-[var(--primary-muted)] text-[var(--primary)] border border-[var(--primary)]/20",
  success: "bg-[var(--success-muted)] text-[var(--success)] border border-[var(--success)]/20",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)] border border-[var(--warning)]/20",
  error: "bg-[var(--error-muted)] text-[var(--error)] border border-[var(--error)]/20",
  info: "bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/20",
  muted: "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]",
  outline: "bg-transparent text-[var(--text-secondary)] border border-[var(--border)]",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-[var(--text-secondary)]",
  primary: "bg-[var(--primary)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  error: "bg-[var(--error)]",
  info: "bg-[var(--accent)]",
  muted: "bg-[var(--text-muted)]",
  outline: "bg-[var(--text-muted)]",
};

export function Badge({
  variant = "default",
  dot = false,
  size = "sm",
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-none whitespace-nowrap font-[var(--font-mono)]",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block rounded-none flex-shrink-0",
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
