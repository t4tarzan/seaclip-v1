import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ActivityEvent, PaginatedResponse } from "../lib/types";

export function useActivity(companyId: string | undefined, page: number = 1) {
  return useQuery({
    queryKey: ["activity", companyId, page],
    queryFn: async () => {
      const res = await api.get<{
        data: ActivityEvent[];
        total: number;
        page: number;
        limit: number;
        hasNextPage: boolean;
      }>(`/companies/${companyId}/activity?page=${page}&pageSize=50`);
      // Map server response shape to PaginatedResponse
      return {
        items: res.data ?? [],
        total: res.total ?? 0,
        page: res.page ?? page,
        pageSize: res.limit ?? 50,
        hasMore: res.hasNextPage ?? false,
      } as PaginatedResponse<ActivityEvent>;
    },
    enabled: !!companyId,
    staleTime: 15_000,
  });
}

export function useRecentActivity(companyId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ["activity-recent", companyId, limit],
    queryFn: () =>
      api.get<ActivityEvent[]>(
        `/companies/${companyId}/activity/recent?limit=${limit}`
      ),
    enabled: !!companyId,
    refetchInterval: 10_000,
  });
}
