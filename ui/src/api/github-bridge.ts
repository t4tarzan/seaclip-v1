import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.js";

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
}

export interface PipelineStatus {
  linked: boolean;
  repo?: string;
  githubIssueNumber?: number;
  labels?: string[];
  stage?: string | null;
  closed?: boolean;
  pipelineMode?: string | null;
  pipelineWaiting?: string | null;
}

export function useGitHubRepos(companyId: string | undefined) {
  return useQuery({
    queryKey: ["github-repos", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: GitHubRepo[] }>(
        `/companies/${companyId}/github/repos`,
      );
      return res.data;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncIssueToGitHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      issueId,
    }: {
      companyId: string;
      issueId: string;
    }) =>
      api.post<{ data: { githubIssueNumber: number; githubIssueUrl: string } }>(
        `/companies/${companyId}/github/sync-issue`,
        { issueId },
      ),
    onSuccess: (_data, { companyId, issueId }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
      void qc.invalidateQueries({ queryKey: ["pipeline-status", companyId, issueId] });
    },
  });
}

export function useStartPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      issueId,
      stage = "plan",
      mode = "auto",
    }: {
      companyId: string;
      issueId: string;
      stage?: string;
      mode?: "auto" | "manual";
    }) =>
      api.post<{ success: boolean; stage: string; mode: string }>(
        `/companies/${companyId}/github/pipeline/start`,
        { issueId, stage, mode },
      ),
    onSuccess: (_data, { companyId, issueId }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
      void qc.invalidateQueries({ queryKey: ["pipeline-status", companyId, issueId] });
    },
  });
}

export function useResumePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      issueId,
      stage,
      mode,
    }: {
      companyId: string;
      issueId: string;
      stage: string;
      mode?: "auto" | "manual";
    }) =>
      api.post<{ success: boolean; stage: string }>(
        `/companies/${companyId}/github/pipeline/resume`,
        { issueId, stage, mode },
      ),
    onSuccess: (_data, { companyId, issueId }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
      void qc.invalidateQueries({ queryKey: ["pipeline-status", companyId, issueId] });
    },
  });
}

export function usePipelineStatus(
  companyId: string | undefined,
  issueId: string | undefined,
) {
  return useQuery({
    queryKey: ["pipeline-status", companyId, issueId],
    queryFn: async () => {
      const res = await api.get<{ data: PipelineStatus }>(
        `/companies/${companyId}/github/pipeline/status/${issueId}`,
      );
      return res.data;
    },
    enabled: !!companyId && !!issueId,
    refetchInterval: 10_000,
  });
}
