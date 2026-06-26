import React, { useState, useEffect } from "react";

interface LeadSearchResult {
  username: string;
  leadScore: number;
  problem: string;
  serviceNeeded: string;
  urgency: "low" | "medium" | "high";
  buyingIntent: number;
  confidence: number;
  qualificationReason: string;
  recommendedAction: string;
  supportingPosts: string[];
  category: string;
  intent: string;
  qualifiedAt: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  profileUrl: string;
  contactEmail: string;
  followingBoost: number;
  followingOverlapCount: number;
  matchedSeedInfluencers: string[];
}

interface NicheLeadSearchProps {
  onAddToCrm: (username: string) => void;
  onViewDetails: (username: string) => void;
  onStartScan: () => void;
  crmLeads: any[];
}

const POPULAR_NICHES = [
  { name: "Fitness", query: "fitness" },
  { name: "Beauty / Skincare", query: "beauty" },
  { name: "Real Estate", query: "real_estate" },
  { name: "SaaS / Tech", query: "saas" },
  { name: "Crypto / Web3", query: "crypto" },
  { name: "Fashion / Apparel", query: "fashion" },
];

export default function NicheLeadSearch({
  onAddToCrm,
  onViewDetails,
  onStartScan,
  crmLeads,
}: NicheLeadSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<LeadSearchResult[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    avgScore: 0,
    seedInfluencersCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Filters State
  const [urgencyFilter, setUrgencyFilter] = useState<string>("");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [hasEmailFilter, setHasEmailFilter] = useState<boolean>(false);

  const fetchLeads = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.append("niche", query.trim());
      
      const res = await fetch(`http://localhost:3001/leads/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch leads");
      }
      const data = await res.json();
      setLeads(data.leads || []);
      setStats(
        data.stats || {
          totalLeads: 0,
          avgScore: 0,
          seedInfluencersCount: 0,
        }
      );
    } catch (err) {
      console.error("Error searching leads:", err);
      setError(err instanceof Error ? err.message : "Error searching leads");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads(searchQuery);
  };

  const handleChipClick = (query: string) => {
    setSearchQuery(query);
    fetchLeads(query);
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    if (urgencyFilter && lead.urgency !== urgencyFilter) return false;
    if (lead.leadScore < minScoreFilter) return false;
    if (hasEmailFilter && !lead.contactEmail) return false;
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#ffd166";
    return "#00baff";
  };

  return (
    <div className="discovery-container animate-fade-in" style={{ padding: "0 1rem" }}>
      {/* Hero Header Banner */}
      <div className="glass-card page-description-banner" style={{ marginBottom: "1.5rem", textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: "#fff", letterSpacing: "-0.5px" }}>
          🔍 Niche Lead Discovery Hub
        </h1>
        <p style={{ margin: "0.5rem auto 0 auto", color: "var(--color-text-dim)", fontSize: "1rem", maxWidth: "600px", lineHeight: "1.5" }}>
          Instantly search through leads previously qualified across target niche scan pipelines. Describe or select a niche to get started.
        </p>
      </div>

      {/* Large Glass Search Card */}
      <div className="glass-card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by niche, category, or industry (e.g. 'fitness', 'skincare routine', 'SaaS')..."
            className="input-field"
            style={{
              flex: 1,
              background: "rgba(255, 255, 255, 0.03)",
              border: "var(--glass-border)",
              borderRadius: "8px",
              color: "#fff",
              padding: "1rem 1rem 1rem 1.25rem",
              fontSize: "1.1rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "0 2rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "8px", cursor: "pointer" }}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px" }}></div> : "Search Hub"}
          </button>
        </form>

        {/* Popular chips */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-dim)", fontWeight: "bold" }}>Popular niches:</span>
          {POPULAR_NICHES.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip.query)}
              className="btn btn-secondary"
              style={{
                padding: "0.4rem 0.8rem",
                fontSize: "0.8rem",
                borderRadius: "9999px",
                minWidth: "auto",
                margin: 0,
                border: searchQuery === chip.query ? "1px solid var(--color-accent)" : "var(--glass-border)",
                background: searchQuery === chip.query ? "rgba(0, 186, 255, 0.1)" : "rgba(255, 255, 255, 0.03)",
              }}
            >
              {chip.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Searched Results & Dashboard Grid */}
      {searched && !loading && (
        <>
          {/* Niche Insights Panel */}
          <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>📊 Niche Search Insights: <span style={{ color: "var(--color-accent)" }}>"{searchQuery}"</span></h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
              <div style={{ padding: "1rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", borderLeft: "3px solid #ffd166" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem" }}>💡 LEAD POOL</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>{stats.totalLeads} qualified leads</div>
              </div>
              <div style={{ padding: "1rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", borderLeft: "3px solid #22c55e" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem" }}>🎯 AVG LEAD SCORE</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>{stats.avgScore} / 100</div>
              </div>
              <div style={{ padding: "1rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", borderLeft: "3px solid #00baff" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem" }}>🔍 SEED COVERAGE</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>{stats.seedInfluencersCount} target influencers</div>
              </div>
            </div>

            {/* Filters panel */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "1.25rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>Urgency:</label>
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.2)", border: "var(--glass-border)", color: "#fff", padding: "0.3rem 0.6rem", borderRadius: "6px", outline: "none" }}
                >
                  <option value="">All Urgency</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="low">Low Only</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>Min Score ({minScoreFilter}):</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minScoreFilter}
                  onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                  style={{ width: "120px", cursor: "pointer", accentColor: "var(--color-accent)" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="hasEmail"
                  checked={hasEmailFilter}
                  onChange={(e) => setHasEmailFilter(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--color-accent)" }}
                />
                <label htmlFor="hasEmail" style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", cursor: "pointer" }}>Contains Email Info</label>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <h3 className="card-title" style={{ fontSize: "1.1rem", margin: "0 0 1.25rem 0" }}>
              📋 Discovery Match Pool ({filteredLeads.length} leads matching filters)
            </h3>

            {filteredLeads.length === 0 ? (
              <div style={{ padding: "4rem 1rem", textAlign: "center", color: "var(--color-text-dim)" }}>
                <h4>No matching leads fit your current filter settings. Try relaxing the filters.</h4>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
                {filteredLeads.map((lead, idx) => {
                  const inCrm = crmLeads.some((cl) => cl.username.toLowerCase() === lead.username.toLowerCase());
                  const scoreColor = getScoreColor(lead.leadScore);

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
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "4px",
                          height: "100%",
                          background: lead.urgency === "high" ? "#ff4566" : lead.urgency === "medium" ? "#ffd166" : "#00baff",
                        }}
                      />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", color: "#a78bfa", fontSize: "1.05rem" }}>
                          @{lead.username}
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: "bold",
                              color: lead.urgency === "high" ? "#ff4566" : lead.urgency === "medium" ? "#ffd166" : "#00baff",
                              background: lead.urgency === "high" ? "rgba(255,69,102,0.15)" : lead.urgency === "medium" ? "rgba(255,209,102,0.15)" : "rgba(0,186,255,0.15)",
                              padding: "0.15rem 0.35rem",
                              borderRadius: "4px",
                            }}
                          >
                            {lead.urgency.toUpperCase()}
                          </span>
                          <span
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "extrabold",
                              color: scoreColor,
                              border: `1px solid ${scoreColor}`,
                              borderRadius: "20px",
                              padding: "0.1rem 0.5rem",
                            }}
                          >
                            {lead.leadScore}
                          </span>
                        </div>
                      </div>

                      {lead.problem && (
                        <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.6rem", borderRadius: "6px" }}>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "#eee", fontStyle: "italic", lineHeight: "1.4" }}>
                            &ldquo;{lead.problem}&rdquo;
                          </p>
                        </div>
                      )}

                      {lead.bio && (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-dim)", lineHeight: "1.3" }}>
                          <strong>Bio:</strong> {lead.bio.slice(0, 100)}{lead.bio.length > 100 ? "..." : ""}
                        </p>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-dim)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "0.5rem" }}>
                        {lead.followerCount ? (
                          <span>👥 <strong>{lead.followerCount.toLocaleString()}</strong> followers</span>
                        ) : null}
                        {lead.contactEmail ? (
                          <span style={{ color: "#22c55e" }}>📧 Has Email</span>
                        ) : null}
                        {lead.category && (
                          <span style={{ background: "rgba(167,139,250,0.1)", color: "#c084fc", padding: "0 0.3rem", borderRadius: "3px" }}>🏷️ {lead.category}</span>
                        )}
                      </div>

                      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => onAddToCrm(lead.username)}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", margin: 0 }}
                          disabled={inCrm}
                        >
                          {inCrm ? "Added to CRM" : "Add to CRM"}
                        </button>
                        <button
                          onClick={() => onViewDetails(lead.username)}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", margin: 0 }}
                        >
                          Details
                        </button>
                      </div>

                      {lead.contactEmail && (
                        <div style={{ display: "flex", gap: "0.25rem", marginTop: "-0.25rem" }}>
                          <a
                            href={`mailto:${lead.contactEmail}`}
                            className="btn btn-secondary"
                            style={{ width: "100%", padding: "0.3rem", fontSize: "0.7rem", margin: 0, textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }}
                          >
                            ✉️ Contact Email
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* No results or Empty Niche searched Fallback Card */}
      {searched && !loading && leads.length === 0 && (
        <div className="glass-card" style={{ padding: "3rem", textAlign: "center", marginTop: "2rem" }}>
          <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>🔭 Niche Leads database is empty</h3>
          <p style={{ color: "var(--color-text-dim)", maxWidth: "500px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
            No leads have been qualified under the niche <strong style={{ color: "var(--color-accent)" }}>"{searchQuery}"</strong> yet. Initiate an automated discovery scan on an influencer in this niche to find fresh qualified leads.
          </p>
          <button
            onClick={onStartScan}
            className="btn btn-primary animate-pulse"
            style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
          >
            🚀 Add & Run Influencer Scan
          </button>
        </div>
      )}
    </div>
  );
}
