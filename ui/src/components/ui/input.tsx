import React from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 flex items-center justify-center text-[var(--text-muted)] pointer-events-none w-4 h-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-10 bg-[var(--bg-alt)] border border-[var(--border)] rounded-none",
              "text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "px-3.5 transition-all duration-150",
              "focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              icon && "pl-9",
              iconRight && "pr-9",
              error && "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/30",
              className
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 flex items-center justify-center text-[var(--text-muted)] pointer-events-none w-4 h-4">
              {iconRight}
            </span>
          )}
        </div>
        {error && <p className="text-[11px] text-[var(--error)]">{error}</p>}
        {hint && !error && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-[var(--bg-alt)] border border-[var(--border)] rounded-none",
            "text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "p-3 resize-y min-h-[80px] transition-all duration-150",
            "focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/30",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-[var(--error)]">{error}</p>}
        {hint && !error && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
