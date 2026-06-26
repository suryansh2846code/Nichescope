import React from "react";

interface QualifiedLead {
  username: string;
  score: number;
  bio?: string;
  followerCount?: number;
  matchedSeedInfluencers?: string[];
  followingBoost?: number;
  originComment: string;
  qualification?: {
    problem: string;
    serviceNeeded: string;
    urgency: string;
    buyingIntent: number;
  };
  timestamp: string;
}

interface LeadsStreamProps {
  leads: QualifiedLead[];
  onAddToCrm: (username: string) => void;
  crmLeads: any[];
}

export default function LeadsStream({ leads, onAddToCrm, crmLeads }: LeadsStreamProps) {
  return (
    <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h3 className="card-title" style={{ fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
        🚀 Streaming Qualified Leads ({leads.length})
      </h3>

      {leads.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--color-text-dim)", fontSize: "0.9rem" }}>
          Searching for qualified leads...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {leads.map((lead, idx) => {
            const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === lead.username.toLowerCase());
            const scoreColor = lead.score >= 80 ? "#22c55e" : lead.score >= 60 ? "#ffd166" : "#00baff";

            return (
              <div
                key={idx}
                className="glass-card animate-slide-up"
                style={{
                  padding: "1.25rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Visual indicator for urgency */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "4px",
                  height: "100%",
                  background: lead.qualification?.urgency === "high" ? "#ff4566" : lead.qualification?.urgency === "medium" ? "#ffd166" : "#00baff"
                }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", color: "#a78bfa", fontSize: "1.05rem" }}>
                    @{lead.username}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      color: lead.qualification?.urgency === "high" ? "#ff4566" : lead.qualification?.urgency === "medium" ? "#ffd166" : "#00baff",
                      background: lead.qualification?.urgency === "high" ? "rgba(255,69,102,0.15)" : lead.qualification?.urgency === "medium" ? "rgba(255,209,102,0.15)" : "rgba(0,186,255,0.15)",
                      padding: "0.15rem 0.35rem",
                      borderRadius: "4px"
                    }}>
                      {lead.qualification?.urgency?.toUpperCase() || "LOW"}
                    </span>
                    <span style={{
                      fontSize: "0.9rem",
                      fontWeight: "extrabold",
                      color: scoreColor,
                      border: `1px solid ${scoreColor}`,
                      borderRadius: "20px",
                      padding: "0.1rem 0.5rem"
                    }}>
                      {lead.score}
                    </span>
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.5rem", borderRadius: "6px" }}>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#eee", fontStyle: "italic" }}>
                    &ldquo;{lead.originComment}&rdquo;
                  </p>
                </div>

                {lead.bio && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                    <strong>Bio:</strong> {lead.bio}
                  </p>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                  {lead.followerCount ? (
                    <span>👥 <strong>{lead.followerCount.toLocaleString()}</strong> followers</span>
                  ) : null}
                  {lead.followingBoost ? (
                    <span style={{ color: "#ffd166" }}>🔥 +{lead.followingBoost} boost</span>
                  ) : null}
                </div>

                {lead.qualification && (
                  <div style={{ fontSize: "0.8rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div><strong>Problem:</strong> {lead.qualification.problem}</div>
                    <div><strong>Needs:</strong> {lead.qualification.serviceNeeded}</div>
                  </div>
                )}

                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => onAddToCrm(lead.username)}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", margin: 0 }}
                    disabled={inCrm}
                  >
                    {inCrm ? "Added to CRM" : "Add to CRM"}
                  </button>
                  <a
                    href={`https://www.instagram.com/${lead.username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", margin: 0, textAlign: "center", textDecoration: "none" }}
                  >
                    View Profile
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
