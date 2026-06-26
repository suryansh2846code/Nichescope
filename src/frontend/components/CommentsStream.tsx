import React from "react";

interface AnalyzedComment {
  username: string;
  comment: string;
  isLead: boolean;
  category?: string;
  intent?: string;
  confidence?: number;
  timestamp: string;
}

interface CommentsStreamProps {
  comments: AnalyzedComment[];
}

export default function CommentsStream({ comments }: CommentsStreamProps) {
  // Take latest 30 comments
  const displayComments = comments.slice(0, 30);

  return (
    <div className="glass-card" style={{ padding: "1.25rem", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 className="card-title" style={{ fontSize: "1.1rem", margin: 0 }}>
          💬 Comments Stream ({comments.length})
        </h3>
        {comments.length > 0 && (
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
            Showing latest 30
          </span>
        )}
      </div>

      {comments.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-dim)", fontSize: "0.9rem", minHeight: "150px" }}>
          Waiting for comments to stream...
        </div>
      ) : (
        <div style={{ overflowY: "auto", flex: 1, maxHeight: "300px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayComments.map((item, idx) => (
            <div
              key={idx}
              className="comment-stream-item animate-slide-up"
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                lineHeight: "1.4",
                background: item.isLead ? "rgba(34, 197, 94, 0.05)" : "rgba(0,0,0,0.15)",
                border: item.isLead ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(255, 255, 255, 0.04)",
                transition: "all 0.3s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ fontWeight: "bold", color: item.isLead ? "#22c55e" : "#eee" }}>
                  @{item.username}
                </span>
                {item.isLead && (
                  <span style={{
                    fontSize: "0.7rem",
                    color: "#a78bfa",
                    background: "rgba(167, 139, 250, 0.15)",
                    padding: "0.05rem 0.25rem",
                    borderRadius: "4px",
                    fontWeight: "bold"
                  }}>
                    🎯 Qualified Lead ({item.intent})
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: item.isLead ? "#fff" : "var(--color-text-dim)", fontStyle: "italic" }}>
                &ldquo;{item.comment}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
