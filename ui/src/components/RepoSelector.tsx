import React from "react";
import { useConnectedRepos, type ConnectedRepo } from "../api/github-bridge.js";

interface RepoSelectorProps {
  companyId: string;
  onSelect: (repo: ConnectedRepo) => void;
  selectedRepoId?: string;
}

export function RepoSelector({ companyId, onSelect, selectedRepoId }: RepoSelectorProps) {
  const { data: repos = [], isLoading, isError } = useConnectedRepos(companyId);

  if (isLoading) {
    return (
      <select
        disabled
        className="w-full text-[12px] text-[var(--text-muted)]"
        style={{
          backgroundColor: "var(--bg-alt)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <option>Loading repositories...</option>
      </select>
    );
  }

  if (isError) {
    return (
      <select
        disabled
        className="w-full text-[12px] text-[var(--error)]"
        style={{
          backgroundColor: "var(--bg-alt)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <option>Failed to load repositories</option>
      </select>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repo = repos.find((r) => r.id === e.target.value);
    if (repo) {
      onSelect(repo);
    }
  };

  return (
    <select
      value={selectedRepoId ?? ""}
      onChange={handleChange}
      className="w-full text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
      style={{
        backgroundColor: "var(--bg-alt)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <option value="">Select a repository...</option>
      {repos.map((repo) => (
        <option key={repo.id} value={repo.id}>
          {repo.repoFullName}
        </option>
      ))}
    </select>
  );
}
