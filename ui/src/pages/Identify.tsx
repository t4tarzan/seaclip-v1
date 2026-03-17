import { useState, useRef, useEffect, useCallback } from "react";
import { useCompanyContext } from "../context/CompanyContext";
import { useGitHubRepos } from "../api/github-bridge";
import { api } from "../api/client";
import { Send, Plus, Loader2, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  messages: ChatMessage[];
  repoSource: "select" | "url";
  selectedRepo: string;
  repoUrl: string;
}

const STORAGE_KEY = "seaclip-identify-session";

function loadSession(): ChatSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { messages: [], repoSource: "select", selectedRepo: "", repoUrl: "" };
}

function saveSession(session: ChatSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

export default function Identify() {
  const { companyId } = useCompanyContext();
  const { data: repos } = useGitHubRepos(companyId);

  // Restore state from sessionStorage
  const [session] = useState(loadSession);
  const [repoSource, setRepoSource] = useState<"select" | "url">(session.repoSource);
  const [selectedRepo, setSelectedRepo] = useState(session.selectedRepo);
  const [repoUrl, setRepoUrl] = useState(session.repoUrl);
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRepo = repoSource === "select" ? selectedRepo : repoUrl;

  // Persist to sessionStorage on every change
  useEffect(() => {
    saveSession({ messages, repoSource, selectedRepo, repoUrl });
  }, [messages, repoSource, selectedRepo, repoUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput("");
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<{ data: { reply: string } }>(
        `/companies/${companyId}/identify/chat`,
        {
          messages: [...messages, userMsg],
          repo: activeRepo || undefined,
        },
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function createIssueFromChat() {
    if (!companyId || messages.length === 0) return;
    setCreatingIssue(true);
    try {
      const res = await api.post<{
        data: { issueId: string; title: string };
      }>(`/companies/${companyId}/identify/extract-issue`, {
        messages,
        repo: activeRepo || undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Issue created: **${res.data.title}**\n\nYou can find it in the Issues page and start the pipeline from there.`,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to create issue: ${msg}` },
      ]);
    } finally {
      setCreatingIssue(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 144px)" }}>
      {/* Repo selector bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 0",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
        >
          Context
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setRepoSource("select")}
            className="text-[12px] px-3 py-1.5 rounded-none"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: repoSource === "select" ? "var(--primary-muted)" : "transparent",
              color: repoSource === "select" ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            My Repos
          </button>
          <button
            onClick={() => setRepoSource("url")}
            className="text-[12px] px-3 py-1.5 rounded-none"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: repoSource === "url" ? "var(--primary-muted)" : "transparent",
              color: repoSource === "url" ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            URL
          </button>
        </div>

        {repoSource === "select" ? (
          <div style={{ flex: 1, maxWidth: 360 }}>
            <Select value={selectedRepo || undefined} onValueChange={(v) => setSelectedRepo(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue placeholder="Select a repo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No repo selected</SelectItem>
                {repos?.map((r) => (
                  <SelectItem key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo or owner/repo"
            className="text-[12px]"
            style={{
              flex: 1,
              maxWidth: 400,
              padding: "6px 10px",
              borderRadius: 0,
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        )}
      </div>

      {/* Chat messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "var(--text-muted)",
            }}
          >
            <span className="text-[14px] font-medium">Start a conversation</span>
            <span className="text-[12px]">
              Discuss ideas, debug issues, or explore a codebase. Create issues from the chat when ready.
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "12px 16px",
                borderRadius: 0,
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                backgroundColor:
                  msg.role === "user" ? "var(--primary)" : "var(--surface)",
                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                border:
                  msg.role === "assistant" ? "1px solid var(--border)" : "none",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 0,
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <Loader2 size={14} className="animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border-subtle)",
          padding: "12px 0",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            title="Clear chat"
            style={{
              padding: 8,
              borderRadius: 0,
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Trash2 size={14} />
          </button>
        )}

        {messages.length >= 2 && (
          <button
            onClick={createIssueFromChat}
            disabled={creatingIssue}
            title="Create issue from this conversation"
            style={{
              padding: "8px 12px",
              borderRadius: 0,
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-secondary)",
              cursor: creatingIssue ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              flexShrink: 0,
              opacity: creatingIssue ? 0.6 : 1,
            }}
          >
            {creatingIssue ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Issue
          </button>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask about the codebase, discuss features, debug issues..."
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            padding: "10px 14px",
            borderRadius: 0,
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            maxHeight: 120,
            overflow: "auto",
          }}
        />

        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            padding: 10,
            borderRadius: 0,
            border: "none",
            backgroundColor:
              input.trim() && !loading ? "var(--primary)" : "var(--surface)",
            color: input.trim() && !loading ? "#fff" : "var(--text-muted)",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
