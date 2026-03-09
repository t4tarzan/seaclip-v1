import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  CircleDot,
  Network,
  DollarSign,
  CheckSquare,
  Activity,
  Settings,
  Target,
  GitBranch,
  GitPullRequest,
  Search,
  Command,
} from "lucide-react";
import { cn } from "../lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    { id: "dashboard", label: "Dashboard", description: "Overview and metrics", icon: LayoutDashboard, action: () => navigate("/"), keywords: ["home", "overview"] },
    { id: "agents", label: "Agents", description: "View all agents", icon: Bot, action: () => navigate("/agents"), keywords: ["bot", "ai"] },
    { id: "issues", label: "Issues", description: "Issue tracker", icon: CircleDot, action: () => navigate("/issues"), keywords: ["bug", "task", "ticket"] },
    { id: "goals", label: "Goals", description: "Objectives and key results", icon: Target, action: () => navigate("/goals"), keywords: ["okr", "target"] },
    { id: "spoke-tasks", label: "Spoke Tasks", description: "Git worktree assignments", icon: GitBranch, action: () => navigate("/spoke-tasks"), keywords: ["branch", "device"] },
    { id: "pull-requests", label: "Pull Requests", description: "Review and merge PRs", icon: GitPullRequest, action: () => navigate("/pull-requests"), keywords: ["pr", "merge"] },
    { id: "edge-mesh", label: "Edge Mesh", description: "Device network topology", icon: Network, action: () => navigate("/edge-mesh"), keywords: ["device", "network", "tailscale"] },
    { id: "costs", label: "Costs", description: "Cost tracking and budgets", icon: DollarSign, action: () => navigate("/costs"), keywords: ["billing", "spend", "money"] },
    { id: "approvals", label: "Approvals", description: "Pending approval requests", icon: CheckSquare, action: () => navigate("/approvals"), keywords: ["approve", "review"] },
    { id: "activity", label: "Activity", description: "Activity log and events", icon: Activity, action: () => navigate("/activity"), keywords: ["log", "events", "history"] },
    { id: "settings", label: "Settings", description: "Company settings", icon: Settings, action: () => navigate("/settings"), keywords: ["config", "preferences"] },
  ];

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
    setQuery("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[520px] bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#374151]">
          <Search size={16} className="text-[#6b7280] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent text-[13px] text-[#f9fafb] placeholder:text-[#6b7280] focus:outline-none"
          />
          <kbd className="text-[10px] text-[#6b7280] bg-[#111827] border border-[#374151] rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[12px] text-[#6b7280]">No results for "{query}"</p>
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === selectedIndex ? "bg-[#20808D]/15" : "hover:bg-[#111827]"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      i === selectedIndex
                        ? "bg-[#20808D]/20 text-[#06b6d4]"
                        : "bg-[#374151] text-[#9ca3af]"
                    )}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[12px] font-medium", i === selectedIndex ? "text-[#f9fafb]" : "text-[#d1d5db]")}>
                      {cmd.label}
                    </p>
                    {cmd.description && (
                      <p className="text-[10px] text-[#6b7280] truncate">{cmd.description}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[#374151] flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-[#6b7280]">
            <kbd className="bg-[#111827] border border-[#374151] rounded px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#6b7280]">
            <kbd className="bg-[#111827] border border-[#374151] rounded px-1 py-0.5 font-mono">↵</kbd>
            select
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#6b7280] ml-auto">
            <Command size={10} />
            <span>K to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
