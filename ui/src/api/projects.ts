import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Project } from "../lib/types";

export function useProjects(companyId: string | undefined) {
  return useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: Project[] }>(`/companies/${companyId}/projects`);
      return res.data;
    },
    enabled: !!companyId,
  });
}
