import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Issue, IssueComment, IssueFilters, PaginatedResponse } from "../lib/types";

function buildIssueParams(filters?: IssueFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.search) params.set("search", filters.search);
  const str = params.toString();
  return str ? `?${str}` : "";
}

export function useIssues(companyId: string | undefined, filters?: IssueFilters) {
  return useQuery({
    queryKey: ["issues", companyId, filters],
    queryFn: async () => {
      const res = await api.get<{ data: Issue[] }>(`/companies/${companyId}/issues${buildIssueParams(filters)}`);
      return res.data;
    },
    enabled: !!companyId,
    staleTime: 10_000,
  });
}

export function useIssue(companyId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["issues", companyId, id],
    queryFn: () => api.get<Issue>(`/companies/${companyId}/issues/${id}`),
    enabled: !!companyId && !!id,
  });
}

export function useIssueComments(companyId: string | undefined, issueId: string | undefined) {
  return useQuery({
    queryKey: ["issue-comments", companyId, issueId],
    queryFn: async () => {
      const res = await api.get<{ data: IssueComment[] }>(`/companies/${companyId}/issues/${issueId}/comments`);
      return Array.isArray(res) ? res : (res.data ?? []);
    },
    enabled: !!companyId && !!issueId,
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Partial<Issue> }) =>
      api.post<Issue>(`/companies/${companyId}/issues`, data),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
    },
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      id,
      data,
    }: {
      companyId: string;
      id: string;
      data: Partial<Issue>;
    }) => api.patch<Issue>(`/companies/${companyId}/issues/${id}`, data),
    onSuccess: (_data, { companyId, id }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
      void qc.invalidateQueries({ queryKey: ["issues", companyId, id] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      issueId,
      body,
    }: {
      companyId: string;
      issueId: string;
      body: string;
    }) =>
      api.post<IssueComment>(`/companies/${companyId}/issues/${issueId}/comments`, { body }),
    onSuccess: (_data, { companyId, issueId }) => {
      void qc.invalidateQueries({ queryKey: ["issue-comments", companyId, issueId] });
    },
  });
}

export function useDeleteIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, id }: { companyId: string; id: string }) =>
      api.delete<void>(`/companies/${companyId}/issues/${id}`),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["issues", companyId] });
    },
  });
}

export function useIssuesPage(
  companyId: string | undefined,
  page: number,
  filters?: IssueFilters
) {
  return useQuery({
    queryKey: ["issues-page", companyId, page, filters],
    queryFn: () => {
      const base = buildIssueParams(filters);
      const sep = base ? "&" : "?";
      return api.get<PaginatedResponse<Issue>>(
        `/companies/${companyId}/issues${base}${sep}page=${page}`
      );
    },
    enabled: !!companyId,
  });
}
