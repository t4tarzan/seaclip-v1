import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.js";

export interface ConnectedRepo {
  id: string;
  companyId: string;
  repoFullName: string;
  githubRepoId: number;
  defaultBranch: string;
  webhookId: number | null;
  installedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function useConnectedRepos(companyId: string | undefined) {
  return useQuery({
    queryKey: ["github-repos", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: ConnectedRepo[] }>(
        `/github-bridge/repos?companyId=${companyId}`,
      );
      return res.data;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

export function useConnectRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      repoFullName,
    }: {
      companyId: string;
      repoFullName: string;
    }) =>
      api.post<ConnectedRepo>("/github-bridge/repos", { companyId, repoFullName }),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["github-repos", companyId] });
    },
  });
}

export function useTriggerSync() {
  return useMutation({
    mutationFn: ({
      repoId,
      companyId,
    }: {
      repoId: string;
      companyId: string;
    }) =>
      api.post<{ synced: boolean; repoFullName: string }>(
        `/github-bridge/sync/${repoId}?companyId=${companyId}`,
        {},
      ),
  });
}
