import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

interface SelectTriggerProps extends RadixSelect.SelectTriggerProps {
  className?: string;
  placeholder?: string;
}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <RadixSelect.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2",
        "bg-[var(--bg-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]",
        "px-3 text-[13px] text-[var(--text-primary)]",
        "focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "data-[placeholder]:text-[var(--text-muted)]",
        "transition-all duration-150",
        className
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown size={14} className="text-[var(--text-muted)] flex-shrink-0" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: RadixSelect.SelectContentProps & { className?: string }) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden",
          "glass-surface rounded-[var(--radius-md)] shadow-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <RadixSelect.Viewport className="p-1.5">{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: RadixSelect.SelectItemProps & { className?: string }) {
  return (
    <RadixSelect.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2",
        "rounded-[var(--radius-sm)] py-2 pl-7 pr-3",
        "text-[13px] text-[var(--text-primary)]",
        "focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] focus:outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "transition-colors",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check size={11} className="text-[var(--primary)]" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function SelectLabel({ className, ...props }: RadixSelect.SelectLabelProps & { className?: string }) {
  return (
    <RadixSelect.Label
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  );
}

export function SelectSeparator({ className, ...props }: RadixSelect.SelectSeparatorProps & { className?: string }) {
  return (
    <RadixSelect.Separator
      className={cn("my-1.5 h-px bg-[var(--border)]", className)}
      {...props}
    />
  );
}
