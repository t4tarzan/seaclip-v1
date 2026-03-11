import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "../../lib/utils";

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuGroup = RadixDropdown.Group;
export const DropdownMenuPortal = RadixDropdown.Portal;
export const DropdownMenuSub = RadixDropdown.Sub;
export const DropdownMenuRadioGroup = RadixDropdown.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: RadixDropdown.DropdownMenuContentProps & { className?: string }) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[180px] overflow-hidden",
          "glass-surface rounded-[var(--radius-md)] shadow-xl",
          "p-1.5",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: RadixDropdown.DropdownMenuItemProps & { className?: string; inset?: boolean }) {
  return (
    <RadixDropdown.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2",
        "rounded-[var(--radius-sm)] px-2.5 py-2",
        "text-[13px] text-[var(--text-primary)]",
        "focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] focus:outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "transition-colors",
        inset && "pl-7",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: RadixDropdown.DropdownMenuCheckboxItemProps & { className?: string }) {
  return (
    <RadixDropdown.CheckboxItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2",
        "rounded-[var(--radius-sm)] py-2 pl-7 pr-2.5",
        "text-[13px] text-[var(--text-primary)]",
        "focus:bg-[var(--surface-raised)] focus:outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RadixDropdown.ItemIndicator>
          <Check size={11} />
        </RadixDropdown.ItemIndicator>
      </span>
      {children}
    </RadixDropdown.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: RadixDropdown.DropdownMenuRadioItemProps & { className?: string }) {
  return (
    <RadixDropdown.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2",
        "rounded-[var(--radius-sm)] py-2 pl-7 pr-2.5",
        "text-[13px] text-[var(--text-primary)]",
        "focus:bg-[var(--surface-raised)] focus:outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RadixDropdown.ItemIndicator>
          <Circle size={6} fill="currentColor" />
        </RadixDropdown.ItemIndicator>
      </span>
      {children}
    </RadixDropdown.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: RadixDropdown.DropdownMenuLabelProps & { className?: string; inset?: boolean }) {
  return (
    <RadixDropdown.Label
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]",
        inset && "pl-7",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: RadixDropdown.DropdownMenuSeparatorProps & { className?: string }) {
  return (
    <RadixDropdown.Separator
      className={cn("my-1.5 h-px bg-[var(--border)]", className)}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: RadixDropdown.DropdownMenuSubTriggerProps & { className?: string; inset?: boolean }) {
  return (
    <RadixDropdown.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2",
        "rounded-[var(--radius-sm)] px-2.5 py-2",
        "text-[13px] text-[var(--text-primary)]",
        "focus:bg-[var(--surface-raised)] focus:outline-none",
        "data-[state=open]:bg-[var(--surface-raised)]",
        inset && "pl-7",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight size={12} className="ml-auto" />
    </RadixDropdown.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: RadixDropdown.DropdownMenuSubContentProps & { className?: string }) {
  return (
    <RadixDropdown.SubContent
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden",
        "glass-surface rounded-[var(--radius-md)] shadow-xl",
        "p-1.5",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}
