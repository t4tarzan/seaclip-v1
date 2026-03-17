/**
 * Sidebar-badges service — aggregate badge counts for the dashboard sidebar.
 * Returns counts for pending approvals, active issues, running agents,
 * online devices, open PRs, and agents in error state.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";

export interface SidebarBadges {
  pendingApprovals: number;
  activeIssues: number;
  runningAgents: number;
  onlineDevices: number;
  openPRs: number;
  errorAgents: number;
}

/**
 * Query all sidebar badge counts in a single round-trip.
 */
export async function getBadges(companyId: string): Promise<SidebarBadges> {
  const db = getDb();

  const result = await db.execute(sql.raw(`
    SELECT
      (SELECT count(*)::int FROM approvals       WHERE company_id = '${companyId}' AND status = 'pending')    AS pending_approvals,
      (SELECT count(*)::int FROM issues           WHERE company_id = '${companyId}' AND status NOT IN ('done', 'cancelled')) AS active_issues,
      (SELECT count(*)::int FROM agents           WHERE company_id = '${companyId}' AND status = 'active')    AS running_agents,
      (SELECT count(*)::int FROM edge_devices     WHERE company_id = '${companyId}' AND status = 'online')    AS online_devices,
      (SELECT count(*)::int FROM pull_requests    WHERE company_id = '${companyId}' AND status = 'open')      AS open_prs,
      (SELECT count(*)::int FROM agents           WHERE company_id = '${companyId}' AND status = 'error')     AS error_agents
  `));

  const rows = (result as any).rows ?? (Array.isArray(result) ? result : []);
  const row = rows[0] as Record<string, unknown> | undefined;

  return {
    pendingApprovals: Number(row?.pending_approvals ?? 0),
    activeIssues: Number(row?.active_issues ?? 0),
    runningAgents: Number(row?.running_agents ?? 0),
    onlineDevices: Number(row?.online_devices ?? 0),
    openPRs: Number(row?.open_prs ?? 0),
    errorAgents: Number(row?.error_agents ?? 0),
  };
}
