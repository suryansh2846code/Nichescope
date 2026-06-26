import React from "react";

interface DiscoveredPost {
  postId: string;
  url: string;
  caption?: string;
  commentCount?: number;
  status: "queued" | "extracting" | "completed";
}

interface PostsTableProps {
  posts: DiscoveredPost[];
}

export default function PostsTable({ posts }: PostsTableProps) {
  return (
    <div className="glass-card" style={{ padding: "1.25rem", height: "100%", display: "flex", flexDirection: "column" }}>
      <h3 className="card-title" style={{ fontSize: "1.1rem", margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        📸 Discovered Posts ({posts.length})
      </h3>
      {posts.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-dim)", fontSize: "0.9rem", minHeight: "150px" }}>
          Waiting for influencer profile posts...
        </div>
      ) : (
        <div style={{ overflowY: "auto", flex: 1, maxHeight: "300px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "var(--color-text-dim)" }}>
                <th style={{ padding: "0.5rem 0.25rem" }}>Post ID</th>
                <th style={{ padding: "0.5rem 0.25rem" }}>Estimated Comments</th>
                <th style={{ padding: "0.5rem 0.25rem", textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.postId} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "0.75rem 0.25rem", fontWeight: "bold" }}>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-accent)", textDecoration: "none" }}
                    >
                      @{post.postId.slice(0, 10)}...
                    </a>
                  </td>
                  <td style={{ padding: "0.75rem 0.25rem", color: "#eee" }}>
                    {post.commentCount ?? "Collecting..."}
                  </td>
                  <td style={{ padding: "0.75rem 0.25rem", textAlign: "right" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.4rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        background:
                          post.status === "completed"
                            ? "rgba(34, 197, 94, 0.15)"
                            : post.status === "extracting"
                            ? "rgba(234, 179, 8, 0.15)"
                            : "rgba(255, 255, 255, 0.05)",
                        color:
                          post.status === "completed"
                            ? "#22c55e"
                            : post.status === "extracting"
                            ? "#eab308"
                            : "var(--color-text-dim)",
                      }}
                    >
                      {post.status === "completed"
                        ? "✅ Done"
                        : post.status === "extracting"
                        ? "🔄 Scraped"
                        : "⏳ Queued"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
