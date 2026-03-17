import React, { useState } from "react";
import { useCompanyContext } from "../context/CompanyContext";
import { useActivity } from "../api/activity";
import { ActivityRow } from "../components/ActivityRow";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonTable } from "../components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { cn } from "../lib/utils";

const ACTION_TYPES = [
  "all", "created", "updated", "deleted", "started", "completed", "failed",
  "approved", "rejected", "invoked", "heartbeat",
] as const;

type ActionFilter = typeof ACTION_TYPES[number];

export default function Activity() {
  const { companyId } = useCompanyContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  const { data, isLoading, isFetching } = useActivity(companyId, page);

  const events = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.ceil(total / pageSize);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      !search ||
      e.actorName.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.entityName.toLowerCase().includes(search.toLowerCase()) ||
      (e.detail ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesAction =
      actionFilter === "all" || e.action.toLowerCase().includes(actionFilter);
    return matchesSearch && matchesAction;
  });

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Activity Log</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {total.toLocaleString()} total events
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 256 }}>
          <Input
            icon={<Search size={12} />}
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Filter size={11} className="text-[var(--text-muted)]" />
          {ACTION_TYPES.map((action) => (
            <button
              key={action}
              onClick={() => { setActionFilter(action); setPage(1); }}
              className={cn(
                "px-2 py-1 text-[10px] rounded-none font-medium transition-colors",
                actionFilter === action
                  ? "bg-[var(--border)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface)]"
              )}
            >
              {action === "all" ? "All" : action}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonTable rows={10} cols={5} />
        ) : filteredEvents.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">No activity found</p>
            {(search || actionFilter !== "all") && (
              <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
                Try adjusting your filters
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="text-[11px] text-[var(--text-muted)]">
            Page {page} of {totalPages} · {total.toLocaleString()} events
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              icon={<ChevronLeft size={12} />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>

            {/* Page numbers */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page - 2 + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "text-[11px] font-medium transition-colors",
                      page === pageNum
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--border)]"
                    )}
                    style={{ width: 28, height: 28, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
