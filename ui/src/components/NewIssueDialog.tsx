import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useCreateIssue } from "../api/issues";
import { useCompanyContext } from "../context/CompanyContext";
import { RepoSelector } from "./RepoSelector";
import type { IssuePriority, IssueStatus } from "../lib/types";

interface NewIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: IssueStatus;
}

export function NewIssueDialog({
  open,
  onOpenChange,
  defaultStatus = "backlog",
}: NewIssueDialogProps) {
  const { companyId } = useCompanyContext();
  const createIssue = useCreateIssue();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<IssueStatus>(defaultStatus);
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [githubRepo, setGithubRepo] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !title.trim()) return;

    await createIssue.mutateAsync({
      companyId,
      data: {
        title,
        description,
        status,
        priority,
        ...(githubRepo ? { metadata: { githubRepo } } : {}),
      },
    });

    setTitle("");
    setDescription("");
    setStatus(defaultStatus);
    setPriority("medium");
    setGithubRepo("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Add a new issue to the board. It will be visible to all agents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue..."
            required
            autoFocus
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description, context, acceptance criteria..."
            className="min-h-[100px]"
          />

          <RepoSelector value={githubRepo} onValueChange={setGithubRepo} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                Status
              </label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as IssueStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as IssuePriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createIssue.isPending}
            >
              Create Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
