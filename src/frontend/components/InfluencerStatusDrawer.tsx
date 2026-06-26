import React, { useState, useEffect } from "react";
import PostsTable from "./PostsTable";
import CommentsStream from "./CommentsStream";
import LeadsStream from "./LeadsStream";

interface InfluencerStatusDrawerProps {
  sessionId: string;
  influencerUsername: string;
  niche: string;
  onClose: () => void;
  onAddToCrm: (username: string) => void;
  crmLeads: any[];
}

export default function InfluencerStatusDrawer({
  sessionId,
  influencerUsername,
  niche,
  onClose,
  onAddToCrm,
  crmLeads
}: InfluencerStatusDrawerProps) {
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
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Connect to Bun WebSocket server
    const ws = new WebSocket(`ws://localhost:3002/ws/discovery/${sessionId}`);

    ws.onopen = () => {
      console.log(`[WebSocket Drawer] Connected to discovery session: ${sessionId}`);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[WebSocket Drawer] Received event:", message);

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
      console.error("[WebSocket Drawer] Connection error:", err);
      setStatus("failed");
    };

    ws.onclose = () => {
      console.log("[WebSocket Drawer] Connection closed");
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

  const getStatusStyle = () => {
    switch (status) {
      case "running":
        return { bg: "rgba(0, 186, 255, 0.15)", text: "#00baff" };
      case "paused":
        return { bg: "rgba(255, 209, 102, 0.15)", text: "#ffd166" };
      case "completed":
        return { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" };
      case "cancelled":
        return { bg: "rgba(255, 69, 102, 0.15)", text: "#ff4566" };
      default:
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" };
    }
  };

  const statusStyle = getStatusStyle();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: isMinimized ? "60px" : "550px",
        background: "rgba(10, 10, 15, 0.95)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        zIndex: 1000,
        boxShadow: "0 -10px 30px rgba(0, 0, 0, 0.5)",
        transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
      }}
    >
      {/* Drawer Header (Handle + Control Title) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          cursor: "pointer",
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: status === "running" ? "#22c55e" : "#888" }} />
            Pipeline Status: <span style={{ color: "#a78bfa" }}>@{influencerUsername}</span>
          </div>
          <span style={{ fontSize: "0.85rem", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.5rem", borderRadius: "4px", color: "var(--color-text-dim)" }}>
            Niche: {niche}
          </span>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-dim)", fontFamily: "monospace" }}>
            Session: {sessionId.slice(0, 16)}...
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Controls Mini Stats */}
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
            <span>Posts Scraped: <strong style={{ color: "#fff" }}>{stats.postsScraped}</strong></span>
            <span>Leads Found: <strong style={{ color: "#22c55e" }}>{stats.leadsCreated}</strong></span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-dim)",
                fontSize: "1rem",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              {isMinimized ? "▲ Expand" : "▼ Minimize"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                background: "none",
                border: "none",
                color: "#ff4566",
                fontSize: "1.2rem",
                cursor: "pointer",
                fontWeight: "bold",
                padding: "0.25rem",
              }}
              title="Close Drawer"
            >
              ✖
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Body (Visible only when not minimized) */}
      {!isMinimized && (
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {/* Dashboard Control & Status Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", display: "block" }}>ELAPSED</span>
                <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{formatTime(elapsedTime)}</span>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", display: "block" }}>STATUS</span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    background: statusStyle.bg,
                    color: statusStyle.text,
                    marginTop: "0.2rem"
                  }}
                >
                  {status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {status === "running" && (
                <button onClick={handlePause} className="btn btn-secondary" style={{ margin: 0, padding: "0.5rem 1rem" }}>
                  ⏸️ Pause
                </button>
              )}
              {status === "paused" && (
                <button onClick={handleResume} className="btn btn-primary" style={{ margin: 0, padding: "0.5rem 1rem" }}>
                  ▶️ Resume
                </button>
              )}
              {(status === "running" || status === "paused") && (
                <button onClick={handleCancel} className="btn btn-secondary" style={{ margin: 0, padding: "0.5rem 1rem", color: "#ff4566", borderColor: "rgba(255,69,102,0.3)" }}>
                  ⏹️ Cancel
                </button>
              )}
            </div>
          </div>

          {/* Stats Summary Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1rem",
              marginBottom: "1.5rem"
            }}
          >
            <div style={{ padding: "0.75rem", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)" }}>POSTS DISCOVERED</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{stats.postsFound}</div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)" }}>COMMENTS EXTRACTED</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{stats.commentsExtracted}</div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)" }}>COMMENTS ANALYZED</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{stats.commentsAnalyzed}</div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)" }}>CRM LEADS GENERATED</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#22c55e" }}>{stats.leadsCreated}</div>
            </div>
          </div>

          {/* Live Data Streams Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.5fr 1.5fr",
              gap: "1.5rem",
              alignItems: "start",
            }}
          >
            <div>
              <PostsTable posts={posts} />
            </div>
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              <CommentsStream comments={comments} />
            </div>
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              <LeadsStream leads={leads} onAddToCrm={onAddToCrm} crmLeads={crmLeads} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
