import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";

function IdentifyForm() {
  const navigate = useNavigate();
  const [deviceId, setDeviceId] = useState("");
  const [userId, setUserId] = useState("");
  const [metadata, setMetadata] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        setError("Metadata must be valid JSON");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await api.post<{ identified: boolean; id: string }>("/identify", {
        deviceId: deviceId.trim() || undefined,
        userId: userId.trim() || undefined,
        metadata: parsedMetadata,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identification failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "32px",
        }}
      >
        <h2 className="text-[18px] font-bold text-[var(--text-primary)]" style={{ marginBottom: 8 }}>
          Identify Device
        </h2>
        <p className="text-[12px] text-[var(--text-muted)]" style={{ marginBottom: 24 }}>
          Register a device or user with this SeaClip hub.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              className="text-[11px] text-[var(--text-secondary)] font-medium"
              style={{ display: "block", marginBottom: 4 }}
            >
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. rpi5-living-room"
              className="w-full text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              style={{
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            />
          </div>

          <div>
            <label
              className="text-[11px] text-[var(--text-secondary)] font-medium"
              style={{ display: "block", marginBottom: 4 }}
            >
              User ID <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. user@example.com"
              className="w-full text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              style={{
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            />
          </div>

          <div>
            <label
              className="text-[11px] text-[var(--text-secondary)] font-medium"
              style={{ display: "block", marginBottom: 4 }}
            >
              Metadata <span className="text-[var(--text-muted)]">(optional JSON)</span>
            </label>
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder='{"location": "office-1", "arch": "arm64"}'
              rows={3}
              className="w-full text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              style={{
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                resize: "none",
                fontFamily: "monospace",
              }}
            />
          </div>

          {error && (
            <p className="text-[11px] text-[var(--error)]">{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!deviceId.trim() && !userId.trim())}
              className="px-4 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--primary)",
                border: "none",
                borderRadius: 8,
              }}
            >
              {isSubmitting ? "Identifying..." : "Identify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Identify() {
  return (
    <ErrorBoundary>
      <IdentifyForm />
    </ErrorBoundary>
  );
}
