import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FolderKanban, CircleDot, ArrowLeft } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useProjects } from "../api/projects";
import { useIssues } from "../api/issues";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { SkeletonTable } from "../components/ui/skeleton";
import { timeAgo } from "../lib/utils";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const { data: projects = [] } = useProjects(companyId);
  const project = projects.find((p) => p.id === id);
  const { data: issues = [], isLoading } = useIssues(companyId, id ? { projectId: id } : undefined);

  return (
    <div className="p-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)} />
        <div className="flex items-center gap-2.5">
          {project && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${project.color}20`, borderColor: `${project.color}40`, borderWidth: 1 }}
            >
              <FolderKanban size={14} style={{ color: project.color }} />
            </div>
          )}
          <div>
            <h2 className="text-[18px] font-bold text-[#f9fafb]">
              {project?.name ?? "Project"}
            </h2>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              {issues.length} issue{issues.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CircleDot size={24} className="text-[#374151] mb-3" />
            <p className="text-[13px] text-[#9ca3af]">No issues in this project</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="hover:bg-[#263244] transition-colors cursor-pointer"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                  >
                    <td>
                      <span className="text-[11px] text-[#6b7280] font-mono">{issue.identifier}</span>
                    </td>
                    <td>
                      <p className="text-[12px] font-semibold text-[#f9fafb]">{issue.title}</p>
                    </td>
                    <td>
                      <StatusBadge type="issue" value={issue.status} />
                    </td>
                    <td>
                      <StatusBadge type="priority" value={issue.priority} />
                    </td>
                    <td>
                      <span className="text-[11px] text-[#9ca3af]">{timeAgo(issue.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
