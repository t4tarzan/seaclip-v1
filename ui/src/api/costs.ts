import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { CostData } from "../lib/types";

// Server response shapes
interface ServerCostSummary {
  totalCostUsd: number;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  periodFrom: string;
  periodTo: string;
  currency: string;
}

interface ServerAgentBreakdown {
  agentId: string;
  agentName?: string;
  adapterType: string;
  totalCostUsd: number;
  totalRuns: number;
  avgCostPerRunUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export function useCosts(companyId: string | undefined) {
  return useQuery({
    queryKey: ["costs", companyId],
    queryFn: async () => {
      // Fetch summary and per-agent breakdown in parallel
      const [summary, agentRes] = await Promise.all([
        api.get<ServerCostSummary>(`/companies/${companyId}/costs`),
        api.get<{ data: ServerAgentBreakdown[] }>(`/companies/${companyId}/costs/by-agent`),
      ]);

      const agents = agentRes.data ?? [];

      return {
        periodStartDate: summary.periodFrom,
        periodEndDate: summary.periodTo,
        totalCents: Math.round((summary.totalCostUsd ?? 0) * 100),
        byAgent: agents.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName ?? a.adapterType ?? "Unknown",
          totalCents: Math.round((a.totalCostUsd ?? 0) * 100),
          inputTokens: a.totalInputTokens ?? 0,
          outputTokens: a.totalOutputTokens ?? 0,
          runCount: a.totalRuns ?? 0,
        })),
        byDay: [], // Server doesn't have daily breakdown yet
      } as CostData;
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useCostsByAgent(companyId: string | undefined) {
  return useQuery({
    queryKey: ["costs-by-agent", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: ServerAgentBreakdown[] }>(
        `/companies/${companyId}/costs/by-agent`
      );
      const agents = res.data ?? [];
      return {
        periodStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEndDate: new Date().toISOString(),
        totalCents: agents.reduce((s, a) => s + Math.round((a.totalCostUsd ?? 0) * 100), 0),
        byAgent: agents.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName ?? a.adapterType ?? "Unknown",
          totalCents: Math.round((a.totalCostUsd ?? 0) * 100),
          inputTokens: a.totalInputTokens ?? 0,
          outputTokens: a.totalOutputTokens ?? 0,
          runCount: a.totalRuns ?? 0,
        })),
        byDay: [],
      } as CostData;
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useCostsHistory(companyId: string | undefined, months: number = 3) {
  return useQuery({
    queryKey: ["costs-history", companyId, months],
    queryFn: async () => {
      // Server doesn't have a history endpoint yet — return empty array
      return [] as CostData[];
    },
    enabled: !!companyId,
    staleTime: 300_000,
  });
}
