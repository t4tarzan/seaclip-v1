import React, { useState, useEffect } from "react";
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
  Bell,
  Menu,
  Target,
  GitBranch,
  GitPullRequest,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
} from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useApprovals } from "../api/approvals";
import { useSidebarBadges } from "../api/sidebar-badges";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/* ── SeaClip Logo ── */

function SeaClipLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SeaClip logo"
        style={{ flexShrink: 0 }}
      >
        <rect width="32" height="32" rx="8" fill="var(--bg)" />
        <circle cx="16" cy="16" r="5" fill="var(--primary)" />
        <circle cx="16" cy="5" r="2.5" fill="var(--accent)" opacity="0.85" />
        <circle cx="27" cy="10" r="2.5" fill="var(--accent)" opacity="0.85" />
        <circle cx="27" cy="22" r="2.5" fill="var(--accent)" opacity="0.85" />
        <circle cx="16" cy="27" r="2.5" fill="var(--accent)" opacity="0.85" />
        <circle cx="5" cy="22" r="2.5" fill="var(--accent)" opacity="0.85" />
        <circle cx="5" cy="10" r="2.5" fill="var(--accent)" opacity="0.85" />
        <line x1="16" y1="11" x2="16" y2="7.5" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="19.8" y1="13" x2="24.7" y2="11.5" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="19.8" y1="19" x2="24.7" y2="20.5" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="16" y1="21" x2="16" y2="24.5" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="12.2" y1="19" x2="7.3" y2="20.5" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="12.2" y1="13" x2="7.3" y2="11.5" stroke="var(--border)" strokeWidth="1.5" />
      </svg>
      {!collapsed && (
        <span style={{ fontSize: 16, letterSpacing: "-0.02em", fontFamily: "'Instrument Serif', Georgia, serif" }}>
          <span style={{ color: "var(--text-primary)" }}>Sea</span>
          <span style={{ color: "var(--primary)" }}>Clip</span>
        </span>
      )}
    </div>
  );
}

/* ── Sidebar Link ── */

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const Icon = item.icon;
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 36,
        borderRadius: 0,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
        padding: collapsed ? "0" : "0 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        width: collapsed ? 36 : "auto",
        margin: collapsed ? "0 auto" : "1px 0",
        backgroundColor: isActive ? "var(--primary-muted)" : "transparent",
        color: isActive ? "var(--primary)" : "var(--text-muted)",
        transition: "all 150ms ease",
      }}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.label}
          </span>
          {item.badge != null && item.badge > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 0,
              minWidth: 16, textAlign: "center", lineHeight: "14px",
              backgroundColor: "var(--error)", color: "#fff",
            }}>
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── Section Header ── */

function SectionHeader({ title, collapsed }: { title: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div style={{ margin: "12px 8px", borderTop: "1px solid var(--border-subtle)" }} />;
  }
  return (
    <div style={{
      padding: "20px 12px 8px",
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
      color: "var(--text-muted)",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {title}
    </div>
  );
}

/* ── Main Layout ── */

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 56;

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { company, companies, setCompanyId } = useCompanyContext();
  const location = useLocation();

  const { data: approvals } = useApprovals(company?.id);
  const pendingApprovals = approvals?.filter((a) => a.status === "pending").length ?? 0;
  const { data: badges } = useSidebarBadges(company?.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarW = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const sections: NavSection[] = [
    {
      title: "Overview",
      items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
    },
    {
      title: "Work",
      items: [
        { to: "/issues", label: "Issues", icon: CircleDot, badge: badges?.activeIssues },
        { to: "/identify", label: "Identify", icon: MessageSquare },
        { to: "/goals", label: "Goals", icon: Target },
        { to: "/agents", label: "Agents", icon: Bot, badge: badges?.errorAgents },
      ],
    },
    {
      title: "Spokes",
      items: [
        { to: "/spoke-tasks", label: "Spoke Tasks", icon: GitBranch },
        { to: "/pull-requests", label: "Pull Requests", icon: GitPullRequest, badge: badges?.openPRs },
        { to: "/edge-mesh", label: "Edge Mesh", icon: Network },
      ],
    },
    {
      title: "Company",
      items: [
        { to: "/costs", label: "Costs", icon: DollarSign },
        { to: "/approvals", label: "Approvals", icon: CheckSquare, badge: pendingApprovals },
        { to: "/activity", label: "Activity", icon: Activity },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  const sidebarInner = (isMobile?: boolean) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center", height: 56, flexShrink: 0,
          padding: isCollapsed ? "0 8px" : "0 20px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <NavLink to="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <SeaClipLogo collapsed={isCollapsed} />
          </NavLink>
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, overflowY: "auto",
          padding: isCollapsed ? "8px 6px" : "8px 12px",
        }}>
          {sections.map((section, i) => (
            <div key={section.title}>
              {i === 0 ? <div style={{ paddingTop: 4 }} /> : <SectionHeader title={section.title} collapsed={isCollapsed} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.items.map((item) => (
                  <SidebarLink key={item.to} item={item} collapsed={isCollapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{
          flexShrink: 0, borderTop: "1px solid var(--border-subtle)",
          padding: isCollapsed ? "12px 8px" : "12px 16px",
        }}>
          {!isCollapsed && companies.length > 1 && (
            <select
              value={company?.id ?? ""}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                width: "100%", marginBottom: 12, fontSize: 11,
                padding: "6px 10px", borderRadius: 0,
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text-secondary)",
                outline: "none", cursor: "pointer",
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? 0 : 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              backgroundColor: "var(--primary-muted)",
              border: "1px solid rgba(56,189,248,0.2)",
              color: "var(--primary)",
            }} title={company?.name ?? "SeaClip"}>
              {company?.name?.charAt(0).toUpperCase() ?? "S"}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {company?.name ?? "SeaClip"}
                  </div>
                </div>
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  style={{
                    padding: 4, borderRadius: 0, border: "none",
                    background: "none", cursor: "pointer",
                    color: "var(--text-muted)", flexShrink: 0,
                    display: "flex", alignItems: "center",
                  }}
                  title="Collapse sidebar"
                >
                  <ChevronsLeft size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      backgroundColor: "var(--bg)",
    }}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: sidebarW,
        minWidth: sidebarW,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        backgroundColor: "var(--bg-alt)",
        transition: "width 200ms ease, min-width 200ms ease",
      }}>
        {sidebarInner()}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)" }} />
          <aside
            style={{
              position: "relative", zIndex: 50,
              width: SIDEBAR_WIDTH, height: "100%",
              display: "flex", flexDirection: "column",
              borderRight: "1px solid var(--border)",
              backgroundColor: "var(--bg-alt)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarInner(true)}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      }}>
        {/* Top Bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 48,
          flexShrink: 0,
          padding: "0 32px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              style={{
                display: "none", // shown via media query below
                padding: 6, borderRadius: 0, border: "none",
                background: "none", cursor: "pointer",
                color: "var(--text-muted)",
              }}
              className="md-hidden-toggle"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                style={{
                  padding: 4, borderRadius: 0, border: "none",
                  background: "none", cursor: "pointer",
                  color: "var(--text-muted)", display: "flex", alignItems: "center",
                }}
                title="Expand sidebar"
              >
                <ChevronsRight size={14} />
              </button>
            )}

            <span style={{
              fontSize: 11, fontWeight: 500,
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {getPageTitle(location.pathname)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              style={{
                position: "relative", padding: 6, borderRadius: 0,
                border: "none", background: "none", cursor: "pointer",
                color: "var(--text-muted)", display: "flex", alignItems: "center",
              }}
              aria-label="Notifications"
            >
              <Bell size={15} />
              {pendingApprovals > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 6, height: 6, borderRadius: "50%",
                  backgroundColor: "var(--error)",
                }} />
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <div style={{
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            padding: "32px 40px",
            boxSizing: "border-box",
          }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/agents": "Agents",
    "/issues": "Issues",
    "/goals": "Goals",
    "/identify": "Identify",
    "/spoke-tasks": "Spoke Tasks",
    "/pull-requests": "Pull Requests",
    "/edge-mesh": "Edge Mesh",
    "/costs": "Costs",
    "/approvals": "Approvals",
    "/activity": "Activity",
    "/settings": "Settings",
    "/inbox": "Inbox",
    "/org-chart": "Org Chart",
  };
  if (map[pathname]) return map[pathname];
  for (const [prefix, title] of Object.entries(map)) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return title;
  }
  return "SeaClip";
}
