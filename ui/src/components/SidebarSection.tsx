import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarSectionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SidebarSection({ label, defaultOpen = true, children }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="group">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 w-full"
      >
        <ChevronRight
          size={10}
          className={cn(
            "text-[var(--text-muted)]/60 transition-transform opacity-0 group-hover:opacity-100",
            open && "rotate-90",
          )}
        />
        <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-[var(--text-muted)]/60">
          {label}
        </span>
      </button>
      {open && <div className="flex flex-col gap-1 mt-0.5">{children}</div>}
    </div>
  );
}
