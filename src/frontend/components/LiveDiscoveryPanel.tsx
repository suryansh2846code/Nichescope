import React, { useState, useEffect } from "react";
import PostsTable from "./PostsTable";
import CommentsStream from "./CommentsStream";
import LeadsStream from "./LeadsStream";

interface LiveDiscoveryPanelProps {
  sessionId: string;
  influencerUsername: string;
  niche: string;
  onClose: () => void;
  onAddToCrm: (username: string) => void;
  crmLeads: any[];
}

export default function LiveDiscoveryPanel({
  sessionId,
  influencerUsername,
  niche,
  onClose,
  onAddToCrm,
  crmLeads
}: LiveDiscoveryPanelProps) {
  const [status, setStatus] = useState<"running" | "paused" | "cancelled" | "completed" | "failed">("running");
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({
    postsFound: 0,
    postsScraped: 0,
    commentsExtracted: 0,
    commentsAnalyzed: 0,
    commentsQualified: 0,
    leadsCreated: 0
  });

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // 1. Connect to Bun WebSocket server
    const ws = new WebSocket(`ws://localhost:3002/ws/discovery/${sessionId}`);

    ws.onopen = () => {
      console.log(`[WebSocket] Connected to discovery session: ${sessionId}`);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[WebSocket] Received event:", message);

      if (message.type === "history") {
        // Hydrate from database history
        const historyEvents = message.events || [];
        setStatus(message.status || "running");
        setStats(message.stats || {
          postsFound: 0,
          postsScraped: 0,
          commentsExtracted: 0,
          commentsAnalyzed: 0,
          commentsQualified: 0,
          leadsCreated: 0
        });

        // Reconstruct state from history
        let initialPosts: any[] = [];
        let initialComments: any[] = [];
        let initialLeads: any[] = [];

        historyEvents.forEach((ev: any) => {
          if (ev.type === "posts_found") {
            initialPosts = (ev.data.posts || []).map((p: any) => ({ ...p, status: "queued", commentCount: 0 }));
          } else if (ev.type === "comments_extracted") {
            initialPosts = initialPosts.map(p =>
              p.postId === ev.data.postId ? { ...p, status: "completed", commentCount: ev.data.commentCount } : p
            );
          } else if (ev.type === "comment_analyzed") {
            initialComments.unshift(ev.data);
          } else if (ev.type === "lead_created") {
            initialLeads.unshift(ev.data);
          }
        });

        setPosts(initialPosts);
        setComments(initialComments);
        setLeads(initialLeads);
      } else {
        // Handle live streaming events
        const { type, data } = message;

        if (type === "posts_found") {
          setPosts((data.posts || []).map((p: any) => ({ ...p, status: "queued", commentCount: 0 })));
          setStats(prev => ({ ...prev, postsFound: data.posts.length }));
        } else if (type === "comments_extracted") {
          setPosts(prev =>
            prev.map(p =>
              p.postId === data.postId ? { ...p, status: "completed", commentCount: data.commentCount } : p
            )
          );
          setStats(prev => ({
            ...prev,
            postsScraped: prev.postsScraped + 1,
            commentsExtracted: prev.commentsExtracted + data.commentCount
          }));
        } else if (type === "comment_analyzed") {
          setComments(prev => [data, ...prev]);
          setStats(prev => ({
            ...prev,
            commentsAnalyzed: prev.commentsAnalyzed + 1,
            commentsQualified: prev.commentsQualified + (data.isLead ? 1 : 0)
          }));
        } else if (type === "lead_created") {
          setLeads(prev => [data, ...prev]);
          setStats(prev => ({ ...prev, leadsCreated: prev.leadsCreated + 1 }));
        } else if (type === "completed" || type === "stage_complete") {
          setStatus("completed");
        } else if (type === "paused") {
          setStatus("paused");
        } else if (type === "resumed") {
          setStatus("running");
        } else if (type === "cancelled") {
          setStatus("cancelled");
        } else if (type === "error" || type === "failed") {
          setStatus("failed");
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[WebSocket] Connection error:", err);
      setStatus("failed");
    };

    ws.onclose = () => {
      console.log("[WebSocket] Connection closed");
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Duration Timer
  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handlePause = async () => {
    try {
      const res = await fetch(`http://localhost:3001/discover/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to pause: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Error pausing session:", err);
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch(`http://localhost:3001/discover/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to resume: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Error resuming session:", err);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this discovery run?")) return;
    try {
      const res = await fetch(`http://localhost:3001/discover/sessions/${sessionId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to cancel: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Error cancelling session:", err);
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (status === "failed") return "❌ Error";
    if (status === "cancelled") return "❌ Cancelled";

    if (stepIndex === 1) {
      // Step 1: Finding posts
      if (stats.postsFound > 0) return "✅ Discovered";
      return "🔄 Searching...";
    }
    if (stepIndex === 2) {
      // Step 2: Comment scraping
      if (stats.postsFound > 0 && stats.postsScraped >= stats.postsFound) return "✅ Extracted";
      if (stats.postsFound > 0) return `🔄 Extracting (${stats.postsScraped}/${stats.postsFound})`;
      return "⏳ Queued";
    }
    if (stepIndex === 3) {
      // Step 3: AI analysis
      if (stats.commentsExtracted > 0 && stats.commentsAnalyzed >= stats.commentsExtracted) return "✅ Analyzed";
      if (stats.commentsExtracted > 0) return `🔄 Classification (${stats.commentsAnalyzed}/${stats.commentsExtracted})`;
      return "⏳ Queued";
    }
    if (stepIndex === 4) {
      // Step 4: Leads scoring
      if (status === "completed") return "✅ Delivery Complete";
      if (stats.commentsQualified > 0) return `🚀 Enqueued CRM (${stats.leadsCreated} leads)`;
      return "⏳ Waiting...";
    }
    return "⏳ Queued";
  };

  const passRate = stats.commentsAnalyzed > 0
    ? Math.round((stats.commentsQualified / stats.commentsAnalyzed) * 100)
    : 0;

  return (
    <div className="discovery-container animate-fade-in" style={{ padding: "0 1rem" }}>
      {/* Header Info Panel */}
      <div className="glass-card page-description-banner" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>
            🔴 Live Discovery: @{influencerUsername}
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.9rem" }}>
            Niche: <strong style={{ color: "#00baff" }}>{niche}</strong> | Session: <span style={{ fontFamily: "monospace" }}>{sessionId}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>ELAPSED TIME</div>
            <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>{formatTime(elapsedTime)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>STATUS</div>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.6rem",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: "bold",
                background:
                  status === "completed"
                    ? "rgba(34, 197, 94, 0.15)"
                    : status === "paused"
                      ? "rgba(234, 179, 8, 0.15)"
                      : status === "failed" || status === "cancelled"
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(0, 186, 255, 0.15)",
                color:
                  status === "completed"
                    ? "#22c55e"
                    : status === "paused"
                      ? "#eab308"
                      : status === "failed" || status === "cancelled"
                        ? "#ef4444"
                        : "#00baff",
              }}
            >
              {status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {status === "running" && (
              <>
                <button
                  onClick={handlePause}
                  className="btn"
                  style={{ margin: 0, padding: "0.5rem 1rem", background: "rgba(234, 179, 8, 0.2)", color: "#eab308", border: "1px solid rgba(234, 179, 8, 0.4)", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  ⏸️ Pause
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-danger"
                  style={{ margin: 0, padding: "0.5rem 1rem", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  ⏹️ Cancel
                </button>
              </>
            )}
            {status === "paused" && (
              <>
                <button
                  onClick={handleResume}
                  className="btn"
                  style={{ margin: 0, padding: "0.5rem 1rem", background: "rgba(34, 197, 94, 0.2)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  ▶️ Resume
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-danger"
                  style={{ margin: 0, padding: "0.5rem 1rem", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  ⏹️ Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ margin: 0, padding: "0.5rem 1rem" }}
            >
              {status === "running" || status === "paused" ? "Minimize" : "Close Dashboard"}
            </button>
          </div>
        </div>

        {/* Stepper Status Indicators */}
        <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>⚙️ Discovery Pipeline Progress</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            {[
              { title: "1. Find Posts", status: getStepStatus(1), color: "#00baff" },
              { title: "2. Scrape Comments", status: getStepStatus(2), color: "#eab308" },
              { title: "3. AI Intent Analyzer", status: getStepStatus(3), color: "#a78bfa" },
              { title: "4. CRM Leads Delivery", status: getStepStatus(4), color: "#22c55e" }
            ].map((step, idx) => (
              <div key={idx} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", borderLeft: `3px solid ${step.color}` }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem" }}>{step.title}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#fff" }}>{step.status}</div>
              </div>
            ))}
          </div>

          {/* Global Progress Bar */}
          {stats.commentsExtracted > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--color-text-dim)", marginBottom: "0.4rem" }}>
                <span>AI Analysis Progress</span>
                <span>{stats.commentsAnalyzed} / {stats.commentsExtracted} comments ({Math.round((stats.commentsAnalyzed / stats.commentsExtracted) * 100)}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  width: `${(stats.commentsAnalyzed / stats.commentsExtracted) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--color-accent), #a78bfa)",
                  transition: "width 0.4s ease"
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Grid: Stats and Stream tables */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem", alignItems: "stretch" }}>
          <PostsTable posts={posts} />
          <CommentsStream comments={comments} />
        </div>

        {/* Leads Streaming Section */}
        <div style={{ marginBottom: "2rem" }}>
          <LeadsStream leads={leads} onAddToCrm={onAddToCrm} crmLeads={crmLeads} />
        </div>
      </div>
      );
}
