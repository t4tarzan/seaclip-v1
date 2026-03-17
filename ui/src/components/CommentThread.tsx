import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { useIssueComments, useAddComment } from "../api/issues";
import { useCompanyContext } from "../context/CompanyContext";
import { timeAgo } from "../lib/utils";
import { MessageSquare } from "lucide-react";

interface CommentThreadProps {
  issueId: string;
}

export function CommentThread({ issueId }: CommentThreadProps) {
  const { companyId } = useCompanyContext();
  const { data: comments = [], isLoading } = useIssueComments(companyId, issueId);
  const addComment = useAddComment();
  const [body, setBody] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !body.trim()) return;
    await addComment.mutateAsync({ companyId, issueId, body });
    setBody("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-[var(--text-muted)]" />
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
          Comments
          {comments.length > 0 && (
            <span className="ml-1.5 text-[11px] text-[var(--text-muted)] font-normal">
              {comments.length}
            </span>
          )}
        </h4>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full skeleton-shimmer flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-24 skeleton-shimmer rounded-none" />
                <div className="h-12 skeleton-shimmer rounded-none" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">
          No comments yet. Be the first to comment.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[...comments].reverse().map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)] flex-shrink-0">
                {(comment.authorName ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {comment.authorName}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <div className="bg-[var(--bg-alt)] border border-[var(--border)] rounded-none p-3">
                  <p className="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[80px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void handleSubmit(e);
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[var(--text-muted)]">⌘+Enter to submit</p>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={addComment.isPending}
            disabled={!body.trim()}
          >
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
