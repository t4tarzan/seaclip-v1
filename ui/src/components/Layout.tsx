import React, { useState } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  CircleDot,
  Network,
  DollarSign,
  CheckSquare,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  Building2,
  Target,
  GitBranch,
  GitPullRequest,
  Inbox,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useCompanyContext } from "../context/CompanyContext";
import { useApprovals } from "../api/approvals";
import { useSidebarBadges } from "../api/sidebar-badges";
import { SidebarAgents } from "./SidebarAgents";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarSection } from "./SidebarSection";
import { BreadcrumbBar } from "./BreadcrumbBar";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

// Top-level nav items (always visible)
const TOP_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
];

// Work section
const WORK_NAV: NavItem[] = [
  { to: "/issues", label: "Issues", icon: CircleDot },
  { to: "/goals", label: "Goals", icon: Target },
];

// Spokes section
const SPOKE_NAV: NavItem[] = [
  { to: "/spoke-tasks", label: "Spoke Tasks", icon: GitBranch },
  { to: "/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { to: "/edge-mesh", label: "Edge Mesh", icon: Network },
];

// Company section
const COMPANY_NAV: NavItem[] = [
  { to: "/costs", label: "Costs", icon: DollarSign },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

// All nav items flat (for mobile bottom nav + page title lookup)
const NAV_ITEMS: NavItem[] = [...TOP_NAV, ...WORK_NAV, ...SPOKE_NAV, ...COMPANY_NAV];

// SeaClip SVG Logo
function SeaClipLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SeaClip logo"
        className="flex-shrink-0"
      >
        <rect width="32" height="32" rx="8" fill="#0a0f1a" />
        <circle cx="16" cy="16" r="5" fill="#20808D" />
        <circle cx="16" cy="5" r="2.5" fill="#06b6d4" opacity="0.85" />
        <circle cx="27" cy="10" r="2.5" fill="#06b6d4" opacity="0.85" />
        <circle cx="27" cy="22" r="2.5" fill="#06b6d4" opacity="0.85" />
        <circle cx="16" cy="27" r="2.5" fill="#06b6d4" opacity="0.85" />
        <circle cx="5" cy="22" r="2.5" fill="#06b6d4" opacity="0.85" />
        <circle cx="5" cy="10" r="2.5" fill="#06b6d4" opacity="0.85" />
        <line x1="16" y1="11" x2="16" y2="7.5" stroke="#374151" strokeWidth="1.5" />
        <line x1="19.8" y1="13" x2="24.7" y2="11.5" stroke="#374151" strokeWidth="1.5" />
        <line x1="19.8" y1="19" x2="24.7" y2="20.5" stroke="#374151" strokeWidth="1.5" />
        <line x1="16" y1="21" x2="16" y2="24.5" stroke="#374151" strokeWidth="1.5" />
        <line x1="12.2" y1="19" x2="7.3" y2="20.5" stroke="#374151" strokeWidth="1.5" />
        <line x1="12.2" y1="13" x2="7.3" y2="11.5" stroke="#374151" strokeWidth="1.5" />
      </svg>
      {!collapsed && (
        <span className="text-[15px] font-bold text-[#f9fafb] tracking-tight">
          Sea<span className="text-[#20808D]">Clip</span>
        </span>
      )}
    </div>
  );
}

function SidebarNavItem({
  item,
  collapsed,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 px-3 h-9 rounded-lg",
          "text-[13px] font-medium transition-all duration-150",
          "hover:bg-[#1f2937] hover:text-[#f9fafb]",
          isActive
            ? "bg-[#20808D]/15 text-[#06b6d4] border border-[#20808D]/25"
            : "text-[#9ca3af] border border-transparent",
          collapsed && "justify-center px-0 w-9 mx-auto"
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            className={cn(
              "flex-shrink-0 transition-colors",
              isActive ? "text-[#06b6d4]" : "text-[#6b7280] group-hover:text-[#9ca3af]"
            )}
          />
          {!collapsed && <span>{item.label}</span>}
          {!collapsed && badge != null && badge > 0 && (
            <span className="ml-auto bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {collapsed && badge != null && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#ef4444] rounded-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { company, companies, setCompanyId } = useCompanyContext();
  const location = useLocation();

  const { data: approvals } = useApprovals(company?.id);
  const pendingApprovals = approvals?.filter((a) => a.status === "pending").length ?? 0;
  const { data: badges } = useSidebarBadges(company?.id);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1a]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 h-full",
          "bg-[#111827] border-r border-[#374151]",
          "transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center h-14 px-3 border-b border-[#374151] flex-shrink-0",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <SeaClipLogo collapsed={sidebarCollapsed} />
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="flex justify-center py-2 border-b border-[#374151]">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Company Selector */}
        {!sidebarCollapsed && companies.length > 1 && (
          <div className="px-3 py-2 border-b border-[#374151]">
            <div className="flex items-center gap-2">
              <Building2 size={13} className="text-[#6b7280] flex-shrink-0" />
              <select
                value={company?.id ?? ""}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex-1 bg-transparent text-[11px] text-[#9ca3af] focus:outline-none cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1f2937]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto py-3",
            sidebarCollapsed ? "px-0" : "px-3",
            "flex flex-col gap-3"
          )}
        >
          {/* Top */}
          <div className="flex flex-col gap-0.5">
            {TOP_NAV.map((item) => (
              <SidebarNavItem key={item.to} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>

          {/* Work */}
          {!sidebarCollapsed ? (
            <SidebarSection label="Work">
              {WORK_NAV.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  item={item}
                  collapsed={false}
                  badge={item.to === "/issues" ? badges?.activeIssues : undefined}
                />
              ))}
            </SidebarSection>
          ) : (
            <div className="flex flex-col gap-0.5">
              {WORK_NAV.map((item) => (
                <SidebarNavItem key={item.to} item={item} collapsed={true} />
              ))}
            </div>
          )}

          {/* Projects (collapsible) */}
          <SidebarProjects collapsed={sidebarCollapsed} />

          {/* Agents (collapsible) */}
          <SidebarAgents collapsed={sidebarCollapsed} />

          {/* Spokes */}
          {!sidebarCollapsed ? (
            <SidebarSection label="Spokes">
              {SPOKE_NAV.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  item={item}
                  collapsed={false}
                  badge={item.to === "/pull-requests" ? badges?.openPRs : undefined}
                />
              ))}
            </SidebarSection>
          ) : (
            <div className="flex flex-col gap-0.5">
              {SPOKE_NAV.map((item) => (
                <SidebarNavItem key={item.to} item={item} collapsed={true} />
              ))}
            </div>
          )}

          {/* Company */}
          {!sidebarCollapsed ? (
            <SidebarSection label="Company">
              {COMPANY_NAV.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  item={item}
                  collapsed={false}
                  badge={item.to === "/approvals" ? pendingApprovals : undefined}
                />
              ))}
            </SidebarSection>
          ) : (
            <div className="flex flex-col gap-0.5">
              {COMPANY_NAV.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  item={item}
                  collapsed={true}
                  badge={item.to === "/approvals" ? pendingApprovals : undefined}
                />
              ))}
            </div>
          )}
        </nav>

        {/* User / Bottom area */}
        {!sidebarCollapsed && (
          <div className="border-t border-[#374151] p-3">
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1f2937] cursor-pointer transition-colors group">
              <div className="w-7 h-7 rounded-full bg-[#20808D]/20 border border-[#20808D]/30 flex items-center justify-center text-[#20808D]">
                <User size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[#f9fafb] truncate">
                  {company?.name ?? "SeaClip"}
                </div>
                <div className="text-[10px] text-[#6b7280] truncate">Admin</div>
              </div>
              <LogOut
                size={12}
                className="text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 h-full bg-[#111827] border-r border-[#374151] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between h-14 px-4 border-b border-[#374151]">
              <SeaClipLogo collapsed={false} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb]"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <div key={item.to} onClick={() => setMobileMenuOpen(false)}>
                  <SidebarNavItem
                    item={item}
                    collapsed={false}
                    badge={item.to === "/approvals" ? pendingApprovals : undefined}
                  />
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center gap-3 h-14 px-4 bg-[#111827] border-b border-[#374151] flex-shrink-0">
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1.5 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937]"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Page title derived from location */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[14px] font-semibold text-[#f9fafb] truncate">
              {getPageTitle(location.pathname)}
            </h1>
            {company && (
              <p className="text-[11px] text-[#6b7280] hidden sm:block">
                {company.name}
              </p>
            )}
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            <button
              className="relative p-1.5 rounded-lg text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {pendingApprovals > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#ef4444] rounded-full" />
              )}
            </button>
            <div className="w-7 h-7 rounded-full bg-[#20808D]/20 border border-[#20808D]/30 flex items-center justify-center text-[#20808D] text-[11px] font-semibold cursor-pointer">
              {company?.name?.charAt(0).toUpperCase() ?? "S"}
            </div>
          </div>
        </header>

        {/* Breadcrumbs */}
        <BreadcrumbBar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around h-14 bg-[#111827] border-t border-[#374151] flex-shrink-0">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive =
              item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors",
                  isActive ? "text-[#06b6d4]" : "text-[#6b7280]"
                )}
              >
                <Icon size={18} />
                <span className="text-[9px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/agents/")) return "Agent Detail";
  if (pathname === "/agents") return "Agents";
  if (pathname.startsWith("/issues/")) return "Issue Detail";
  if (pathname === "/issues") return "Issues";
  if (pathname === "/goals") return "Goals";
  if (pathname === "/edge-mesh") return "Edge Mesh";
  if (pathname === "/spoke-tasks") return "Spoke Tasks";
  if (pathname === "/pull-requests") return "Pull Requests";
  if (pathname === "/costs") return "Cost Tracking";
  if (pathname.startsWith("/projects/")) return "Project Detail";
  if (pathname === "/approvals") return "Approvals";
  if (pathname.startsWith("/approvals/")) return "Approval Detail";
  if (pathname === "/activity") return "Activity";
  if (pathname === "/settings") return "Settings";
  return "SeaClip";
}
