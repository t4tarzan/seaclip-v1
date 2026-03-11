import React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  noPadding?: boolean;
  glass?: boolean;
}

export function Card({ children, className, hover = false, noPadding = false, glass = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)]",
        glass
          ? "glass-card"
          : "bg-[var(--card)]",
        !noPadding && "p-5",
        hover && "transition-all duration-[250ms] hover:border-[var(--primary)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action, children, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
        )}
        {description && (
          <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">{description}</p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--border)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
