import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useGitHubRepos } from "../api/github-bridge";
import { useCompanyContext } from "../context/CompanyContext";

interface RepoSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function RepoSelector({ value, onValueChange }: RepoSelectorProps) {
  const { companyId } = useCompanyContext();
  const { data: repos, isLoading } = useGitHubRepos(companyId);

  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
        GitHub Repository
      </label>
      <Select value={value || undefined} onValueChange={(v) => onValueChange(v === "__none__" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading repos..." : "Select repository (optional)"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {repos?.map((repo) => (
            <SelectItem key={repo.full_name} value={repo.full_name}>
              {repo.name}
              {repo.description ? ` — ${repo.description.slice(0, 40)}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
