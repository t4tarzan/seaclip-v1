import React from "react";
import { useCompanyContext } from "../context/CompanyContext";
import { useCosts } from "../api/costs";
import { MetricCard } from "../components/MetricCard";
import { SkeletonCard, SkeletonTable } from "../components/ui/skeleton";
import { formatCents } from "../lib/utils";
import { DollarSign, TrendingUp, Zap, BarChart2 } from "lucide-react";
import { cn } from "../lib/utils";

function DailySpendChart({ data }: { data: { date: string; totalCents: number }[] }) {
  const max = Math.max(...data.map((d) => d.totalCents), 1);
  const recent = data.slice(-30);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 96 }}>
      {recent.map((day) => {
        const height = Math.max(2, (day.totalCents / max) * 100);
        const date = new Date(day.date);
        const isToday =
          date.toDateString() === new Date().toDateString();
        return (
          <div
            key={day.date}
            className="group"
            style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
            title={`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${formatCents(day.totalCents)}`}
          >
            <div
              className={cn(
                "w-full rounded-sm transition-all duration-200 group-hover:opacity-100",
                isToday ? "bg-[var(--accent)]" : "bg-[var(--primary)]/60"
              )}
              style={{ height: `${height}%` }}
            />
            {/* Tooltip */}
            <div className="text-[9px] text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", zIndex: 10 }}>
              {formatCents(day.totalCents)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Costs() {
  const { companyId } = useCompanyContext();
  const { data, isLoading } = useCosts(companyId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard />
        <SkeletonTable />
      </div>
    );
  }

  const totalCents = data?.totalCents ?? 0;
  const agents = data?.byAgent ?? [];
  const dailyData = data?.byDay ?? [];
  const avgDaily =
    dailyData.length > 0
      ? dailyData.reduce((s, d) => s + d.totalCents, 0) / dailyData.length
      : 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Cost Tracking</h2>
        <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
          {data?.periodStartDate && data?.periodEndDate
            ? `${new Date(data.periodStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(data.periodEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : "Current billing period"}
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard
          label="Total Spend"
          value={formatCents(totalCents)}
          description="This billing period"
          icon={<DollarSign />}
          accent="success"
        />
        <MetricCard
          label="Avg Daily Spend"
          value={formatCents(avgDaily)}
          description="Over last 30 days"
          icon={<TrendingUp />}
          accent="primary"
        />
        <MetricCard
          label="Total Runs"
          value={agents.reduce((s, a) => s + a.runCount, 0).toLocaleString()}
          description="Across all agents"
          icon={<Zap />}
          accent="info"
        />
      </div>

      {/* Daily spend chart */}
      {dailyData.length > 0 && (
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart2 size={14} className="text-[var(--primary)]" />
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Daily Spend</h3>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">Last 30 days</span>
          </div>
          <DailySpendChart data={dailyData} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span className="text-[10px] text-[var(--text-muted)]">
              {dailyData.length > 0
                ? new Date(dailyData[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : ""}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">Today</span>
          </div>
        </div>
      )}

      {/* Per-agent breakdown */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Per-Agent Breakdown</h3>
        </div>
        {agents.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center" }}>
            <DollarSign size={24} className="text-[var(--border)]" style={{ marginBottom: 8 }} />
            <p className="text-[12px] text-[var(--text-muted)]">No cost data available</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Runs</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Total Cost</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .sort((a, b) => b.totalCents - a.totalCents)
                  .map((agent) => {
                    const pct =
                      totalCents > 0
                        ? ((agent.totalCents / totalCents) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr key={agent.agentId}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="text-[var(--primary)] text-[9px] font-bold" style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: "rgba(var(--primary-rgb), 0.15)", border: "1px solid rgba(var(--primary-rgb), 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {agent.agentName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[12px] font-medium text-[var(--text-primary)]">
                              {agent.agentName}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-[11px]">
                          {agent.runCount.toLocaleString()}
                        </td>
                        <td className="font-mono text-[11px]">
                          {agent.inputTokens.toLocaleString()}
                        </td>
                        <td className="font-mono text-[11px]">
                          {agent.outputTokens.toLocaleString()}
                        </td>
                        <td>
                          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                            {formatCents(agent.totalCents)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, backgroundColor: "var(--border)", borderRadius: 9999, overflow: "hidden" }}>
                              <div
                                style={{ height: "100%", backgroundColor: "var(--primary)", borderRadius: 9999, width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono" style={{ width: 40, textAlign: "right" }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--bg-alt)]">
                  <td style={{ padding: "12px" }}>
                    <span className="text-[11px] font-semibold text-[var(--text-primary)]">Total</span>
                  </td>
                  <td className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ padding: "12px" }}>
                    {agents.reduce((s, a) => s + a.runCount, 0).toLocaleString()}
                  </td>
                  <td className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ padding: "12px" }}>
                    {agents.reduce((s, a) => s + a.inputTokens, 0).toLocaleString()}
                  </td>
                  <td className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ padding: "12px" }}>
                    {agents.reduce((s, a) => s + a.outputTokens, 0).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span className="text-[12px] font-bold text-[var(--accent)]">
                      {formatCents(totalCents)}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span className="text-[11px] text-[var(--text-secondary)] font-mono">100%</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
