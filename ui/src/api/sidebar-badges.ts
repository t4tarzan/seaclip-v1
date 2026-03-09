import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { SidebarBadges } from "../lib/types";

export function useSidebarBadges(companyId: string | undefined) {
  return useQuery({
    queryKey: ["sidebar-badges", companyId],
    queryFn: () => api.get<SidebarBadges>(`/companies/${companyId}/sidebar-badges`),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
}
