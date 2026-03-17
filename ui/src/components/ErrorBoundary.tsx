import React from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 600, margin: "0 auto", fontFamily: "monospace" }}>
          <h2 style={{ color: "#ef4444", marginBottom: 16 }}>Something went wrong</h2>
          <pre style={{ background: "#1a1a2e", color: "#e2e8f0", padding: 16, borderRadius: 0, overflow: "auto", fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            style={{ marginTop: 16, padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 0, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
