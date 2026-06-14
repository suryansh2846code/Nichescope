import React, { useState, useEffect, useCallback } from "react";

const API_BASE_URL = "http://localhost:3001";

interface Lead {
  _id: string;
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  profileUrl: string;
  contactEmail?: string;
  foundVia: string;
  niche: string;
  scrapedAt: string;
  rawData?: any;
}

interface Job {
  id: string;
  name: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";
  progress: number;
  data: {
    username: string;
    niche: string;
  };
  attemptsMade: number;
  failedReason?: string;
  returnvalue?: any;
}

interface PostAnalysisResult {
  _id: string;
  postId: string;
  username: string;
  isLead: boolean;
  category: string;
  intent: string;
  confidence: number;
  leadScore: number;
  extractedKeywords: string[];
  summary: string;
  createdAt: string;
  analyzedAt: string;
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"pipeline" | "ai">("pipeline");

  // Scrape Form State
  const [scrapeUsername, setScrapeUsername] = useState("");
  const [scrapeNiche, setScrapeNiche] = useState("");
  const [submittingScrape, setSubmittingScrape] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Job Tracker State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Leads Grid State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  // Filters State
  const [filterNiche, setFilterNiche] = useState("");
  const [filterMinFollowers, setFilterMinFollowers] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);

  // AI Tab State
  const [aiStats, setAiStats] = useState<{
    categories: { _id: string; count: number }[];
    intents: { _id: string; count: number }[];
    totalLeads: number;
  }>({ categories: [], intents: [], totalLeads: 0 });

  const [recentAnalysis, setRecentAnalysis] = useState<PostAnalysisResult[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // AI Filters
  const [filterAiCategory, setFilterAiCategory] = useState("");
  const [filterAiIntent, setFilterAiIntent] = useState("");
  const [filterAiMinScore, setFilterAiMinScore] = useState("");
  const [filterAiIsLead, setFilterAiIsLead] = useState(false);

  // Load leads from backend
  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterNiche.trim()) {
        queryParams.append("niche", filterNiche.trim());
      }
      if (filterMinFollowers.trim()) {
        queryParams.append("minFollowers", filterMinFollowers.trim());
      }
      if (filterHasEmail) {
        queryParams.append("hasEmail", "true");
      }

      const res = await fetch(`${API_BASE_URL}/leads?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch leads: ${res.statusText}`);
      }
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : "Error fetching leads");
    } finally {
      setLeadsLoading(false);
    }
  }, [filterNiche, filterMinFollowers, filterHasEmail]);

  // Fetch AI Data
  const fetchAiData = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      // 1. Fetch stats
      const statsRes = await fetch(`${API_BASE_URL}/analysis/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAiStats(statsData);
      }

      // 2. Fetch filtered analysis
      const queryParams = new URLSearchParams();
      if (filterAiCategory) queryParams.append("category", filterAiCategory);
      if (filterAiIntent) queryParams.append("intent", filterAiIntent);
      if (filterAiMinScore.trim()) queryParams.append("minScore", filterAiMinScore.trim());
      if (filterAiIsLead) queryParams.append("isLead", "true");

      const analysisRes = await fetch(`${API_BASE_URL}/analysis?${queryParams.toString()}`);
      if (!analysisRes.ok) {
        throw new Error(`Failed to fetch AI analysis: ${analysisRes.statusText}`);
      }
      const analysisData = await analysisRes.json();
      setRecentAnalysis(analysisData);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Error fetching AI intelligence data");
    } finally {
      setAnalysisLoading(false);
    }
  }, [filterAiCategory, filterAiIntent, filterAiMinScore, filterAiIsLead]);

  // Initial load and filter reload
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300); // Debounce updates by 300ms

    return () => clearTimeout(timer);
  }, [fetchLeads]);

  // AI load and filter reload
  useEffect(() => {
    if (activeTab === "ai") {
      const timer = setTimeout(() => {
        fetchAiData();
      }, 300); // Debounce updates by 300ms
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchAiData]);

  // Poll job status
  useEffect(() => {
    if (!activeJobId) return;

    let intervalId: any;

    const pollJob = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/jobs/${activeJobId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch job status: ${res.statusText}`);
        }
        const data = (await res.json()) as Job;
        setJob(data);

        if (data.state === "completed" || data.state === "failed") {
          clearInterval(intervalId);
          setActiveJobId(null);
          // Wait a moment and refresh leads and AI data
          setTimeout(() => {
            fetchLeads();
            fetchAiData();
          }, 1000);
        }
      } catch (err) {
        setJobError(err instanceof Error ? err.message : "Error tracking job");
        clearInterval(intervalId);
        setActiveJobId(null);
      }
    };

    pollJob(); // Fetch immediately once
    intervalId = setInterval(pollJob, 2000);

    return () => clearInterval(intervalId);
  }, [activeJobId, fetchLeads, fetchAiData]);

  // Start scrape job handler
  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrapeError(null);
    setSuccessMessage(null);

    const cleanUsername = scrapeUsername.replace(/^@/, "").trim();
    if (!cleanUsername) {
      setScrapeError("Username is required");
      return;
    }

    setSubmittingScrape(true);

    try {
      const res = await fetch(`${API_BASE_URL}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          niche: scrapeNiche.trim() || undefined, // will default to "general" if blank
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Error starting scrape: ${res.statusText}`);
      }

      const data = await res.json();
      setActiveJobId(data.jobId);
      setSuccessMessage(`Scrape job #${data.jobId} submitted successfully!`);
      setJob(null); // Reset current tracked job info
      setJobError(null);
      setScrapeUsername("");
      setScrapeNiche("");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Failed to initiate scraping");
    } finally {
      setSubmittingScrape(false);
    }
  };

  // CSV Export utility
  const exportToCSV = () => {
    if (leads.length === 0) return;

    const headers = [
      "Username",
      "Full Name",
      "Niche",
      "Followers",
      "Following",
      "Profile URL",
      "Scraped At",
      "Email Address",
      "Bio",
    ];

    const rows = leads.map((lead) => [
      lead.username,
      lead.fullName || "",
      lead.niche,
      lead.followerCount,
      lead.followingCount,
      lead.profileUrl,
      lead.scrapedAt,
      lead.contactEmail || "N/A",
      `"${(lead.bio || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nichescope_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return "score-badge-circle score-badge-high";
    if (score >= 50) return "score-badge-circle score-badge-medium";
    return "score-badge-circle score-badge-low";
  };

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    return `ai-category-badge cat-${cat}`;
  };

  const intentDisplayNames: Record<string, string> = {
    seeking_help: "🙋 Seeking Help",
    seeking_recommendation: "🤝 Seeking Recommendation",
    purchase_intent: "🛍️ Purchase Intent",
    complaint: "🚨 Complaint",
    question: "❓ Question",
    discussion: "💬 Discussion",
    promotion: "📢 Promotion",
    other: "⚡ Other",
  };

  const totalCategoriesCount = aiStats.categories.reduce((acc, cat) => acc + cat.count, 0);
  const totalIntentsCount = aiStats.intents.reduce((acc, intent) => acc + intent.count, 0);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header animate-fade-in">
        <div className="brand">
          <div className="brand-logo">🌌</div>
          <div className="brand-text">
            <h1>NicheScope</h1>
            <p>Premium Instagram Lead Intelligence & Automation</p>
          </div>
        </div>
        <div className="status-pill-container">
          <div className="status-pill active-badge">Pipeline: Online</div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation animate-fade-in" style={{ marginBottom: "2rem" }}>
        <button
          className={`tab-btn ${activeTab === "pipeline" ? "active" : ""}`}
          onClick={() => setActiveTab("pipeline")}
        >
          🎛️ Lead Generation Pipeline
        </button>
        <button
          className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          🌌 AI Lead Intelligence
        </button>
      </div>

      {activeTab === "pipeline" ? (
        /* Main Grid */
        <main className="dashboard-grid">
          {/* Left Panel: Form & Active Tracker */}
          <section className="left-panel animate-slide-in">
            {/* Scrape Form Card */}
            <div className="glass-card card-form">
              <h2 className="card-title">🔍 Discover New Leads</h2>
              <form onSubmit={handleScrapeSubmit} className="scrape-form">
                <div className="input-group">
                  <label htmlFor="username">Instagram Handle</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="e.g. yoga_with_adriene"
                    value={scrapeUsername}
                    onChange={(e) => setScrapeUsername(e.target.value)}
                    disabled={submittingScrape}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="niche">Niche Focus</label>
                  <input
                    id="niche"
                    type="text"
                    placeholder="e.g. yoga, tech (optional)"
                    value={scrapeNiche}
                    onChange={(e) => setScrapeNiche(e.target.value)}
                    disabled={submittingScrape}
                  />
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary ${submittingScrape ? "loading" : ""}`}
                  disabled={submittingScrape}
                >
                  {submittingScrape ? "Queueing Job..." : "Launch Scraper"}
                </button>
              </form>

              {scrapeError && <div className="toast toast-error">{scrapeError}</div>}
              {successMessage && <div className="toast toast-success">{successMessage}</div>}
            </div>

            {/* Active Job Status Panel */}
            {(activeJobId || job || jobError) && (
              <div className="glass-card card-job-status animate-fade-in">
                <h2 className="card-title">⚙️ Scraper Engine Tracker</h2>

                {jobError && <div className="toast toast-error">Engine Tracking Error: {jobError}</div>}

                {activeJobId && !job && (
                  <div className="job-loading">
                    <div className="spinner"></div>
                    <p>Initializing connection to scraper daemon (Job ID: #{activeJobId})...</p>
                  </div>
                )}

                {job && (
                  <div className="job-details">
                    <div className="job-header">
                      <span className="job-id">Job ID: #{job.id}</span>
                      <span className={`status-badge status-${job.state}`}>
                        {job.state.toUpperCase()}
                      </span>
                    </div>

                    <div className="job-body">
                      <p>
                        <strong>Target:</strong> @{job.data.username}
                      </p>
                      {job.data.niche && (
                        <p>
                          <strong>Niche:</strong> {job.data.niche}
                        </p>
                      )}
                      {job.failedReason && (
                        <div className="job-error-msg">
                          <strong>Failure details:</strong> {job.failedReason}
                        </div>
                      )}
                    </div>

                    <div className="job-progress-container">
                      <div className="progress-labels">
                        <span>Engine Process</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {job.state === "completed" && job.returnvalue?.profile && (
                      <div className="job-results-summary animate-fade-in">
                        <h4>📊 Fast Scraped Profile Results</h4>
                        <ul>
                          <li><strong>Name:</strong> {job.returnvalue.profile.fullName}</li>
                          <li><strong>Followers:</strong> {job.returnvalue.profile.followerCount.toLocaleString()}</li>
                          <li><strong>Posts:</strong> {job.returnvalue.profile.postCount.toLocaleString()}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right Panel: Filters & Table */}
          <section className="right-panel animate-slide-in">
            {/* Filters Card */}
            <div className="glass-card card-filters">
              <div className="filters-header">
                <h2 className="card-title">🎛️ Filter Leads</h2>
                <button
                  onClick={exportToCSV}
                  className="btn btn-secondary"
                  disabled={leads.length === 0}
                >
                  📥 Download CSV ({leads.length})
                </button>
              </div>

              <div className="filters-grid">
                <div className="input-group">
                  <label htmlFor="filterNiche">Filter by Niche</label>
                  <input
                    id="filterNiche"
                    type="text"
                    placeholder="e.g. yoga"
                    value={filterNiche}
                    onChange={(e) => setFilterNiche(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="filterFollowers">Min Followers</label>
                  <input
                    id="filterFollowers"
                    type="number"
                    placeholder="e.g. 5000"
                    value={filterMinFollowers}
                    onChange={(e) => setFilterMinFollowers(e.target.value)}
                  />
                </div>

                <div className="checkbox-group">
                  <input
                    id="filterEmail"
                    type="checkbox"
                    checked={filterHasEmail}
                    onChange={(e) => setFilterHasEmail(e.target.checked)}
                  />
                  <label htmlFor="filterEmail">Has Email Contact</label>
                </div>
              </div>
            </div>

            {/* Leads List Table */}
            <div className="glass-card card-table">
              <h2 className="card-title">📂 Discovered Intelligence Database</h2>

              {leadsLoading && (
                <div className="table-loading-container">
                  <div className="spinner"></div>
                  <p>Syncing directory cache...</p>
                </div>
              )}

              {leadsError && <div className="toast toast-error">{leadsError}</div>}

              {!leadsLoading && !leadsError && leads.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>No Leads Match Your Criteria</h3>
                  <p>Run a scraper or clear your filters to display directory results.</p>
                </div>
              )}

              {!leadsLoading && !leadsError && leads.length > 0 && (
                <div className="table-responsive">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th>Instagram Profile</th>
                        <th>Full Name</th>
                        <th>Niche</th>
                        <th>Followers</th>
                        <th>Scraped Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead._id} className="lead-row">
                          <td>
                            <a
                              href={lead.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="profile-link"
                            >
                              @{lead.username}
                            </a>
                          </td>
                          <td>{lead.fullName || <span className="dim">Unnamed</span>}</td>
                          <td>
                            <span className="niche-badge">{lead.niche}</span>
                          </td>
                          <td>{lead.followerCount.toLocaleString()}</td>
                          <td>
                            <span className="scraped-date">
                              {new Date(lead.scrapedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        /* AI Dashboard Panel */
        <div className="ai-dashboard animate-slide-in">
          {/* Stats Row */}
          <div className="ai-stats-row">
            <div className="stat-card">
              <span className="stat-card-label">Total Leads</span>
              <span className="stat-card-value">{aiStats.totalLeads}</span>
              <span className="stat-card-desc">Identified in database</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">High-Quality Leads</span>
              <span className="stat-card-value">
                {recentAnalysis.filter((x) => x.leadScore >= 80).length}
              </span>
              <span className="stat-card-desc">Leads with score &gt;= 80</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Categories Analyzed</span>
              <span className="stat-card-value">{aiStats.categories.length}</span>
              <span className="stat-card-desc">Unique niches detected</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Top Intent Class</span>
              <span className="stat-card-value" style={{ fontSize: "1.2rem" }}>
                {aiStats.intents[0]?._id ? (intentDisplayNames[aiStats.intents[0]._id] || aiStats.intents[0]._id) : "N/A"}
              </span>
              <span className="stat-card-desc">Most frequent intent type</span>
            </div>
          </div>

          {/* AI Main Grid */}
          <div className="ai-main-layout">
            {/* Left Column: Filters and Grid */}
            <div className="ai-left-column" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Filters Card */}
              <div className="glass-card card-filters">
                <div className="filters-header">
                  <h2 className="card-title">🎛️ Filter AI Intelligence</h2>
                </div>
                <div className="filters-grid">
                  <div className="input-group">
                    <label htmlFor="aiCategory">Category</label>
                    <select
                      id="aiCategory"
                      value={filterAiCategory}
                      onChange={(e) => setFilterAiCategory(e.target.value)}
                      style={{
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "var(--glass-border)",
                        borderRadius: "8px",
                        color: "#fff",
                        padding: "0.75rem",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      <option value="">All Categories</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="fitness">Fitness</option>
                      <option value="beauty">Beauty</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="technology">Technology</option>
                      <option value="finance">Finance</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="aiIntent">Intent</label>
                    <select
                      id="aiIntent"
                      value={filterAiIntent}
                      onChange={(e) => setFilterAiIntent(e.target.value)}
                      style={{
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "var(--glass-border)",
                        borderRadius: "8px",
                        color: "#fff",
                        padding: "0.75rem",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      <option value="">All Intents</option>
                      <option value="seeking_help">🙋 Seeking Help</option>
                      <option value="seeking_recommendation">🤝 Seeking Recommendation</option>
                      <option value="purchase_intent">🛍️ Purchase Intent</option>
                      <option value="complaint">🚨 Complaint</option>
                      <option value="question">❓ Question</option>
                      <option value="discussion">💬 Discussion</option>
                      <option value="promotion">📢 Promotion</option>
                      <option value="other">⚡ Other</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="aiMinScore">Min Lead Score</label>
                    <input
                      id="aiMinScore"
                      type="number"
                      placeholder="e.g. 50"
                      value={filterAiMinScore}
                      onChange={(e) => setFilterAiMinScore(e.target.value)}
                    />
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="aiIsLead"
                      type="checkbox"
                      checked={filterAiIsLead}
                      onChange={(e) => setFilterAiIsLead(e.target.checked)}
                    />
                    <label htmlFor="aiIsLead">Show Leads Only</label>
                  </div>
                </div>
              </div>

              {/* Lead Cards List */}
              <div className="glass-card card-table" style={{ padding: "1.5rem" }}>
                <h2 className="card-title">🌌 Classified Leads & Intelligence</h2>

                {analysisLoading && (
                  <div className="table-loading-container">
                    <div className="spinner"></div>
                    <p>Running semantic classification...</p>
                  </div>
                )}

                {analysisError && <div className="toast toast-error">{analysisError}</div>}

                {!analysisLoading && !analysisError && recentAnalysis.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>No AI Intelligence Matches Your Criteria</h3>
                    <p>Scrape accounts with captions, and let the AI background worker analyze them.</p>
                  </div>
                )}

                {!analysisLoading && !analysisError && recentAnalysis.length > 0 && (
                  <div className="ai-leads-grid">
                    {recentAnalysis.map((item) => (
                      <div key={item._id} className="ai-lead-card">
                        <div className={getScoreBadgeClass(item.leadScore)}>
                          {item.leadScore}
                        </div>
                        <div className="ai-lead-details">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="ai-lead-user">
                              <a
                                href={`https://instagram.com/${item.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="profile-link"
                              >
                                @{item.username}
                              </a>
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                              {new Date(item.analyzedAt || item.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="ai-lead-meta">
                            <span className={getCategoryBadgeClass(item.category)}>
                              {item.category}
                            </span>
                            <span className="ai-intent-badge">
                              {intentDisplayNames[item.intent] || item.intent}
                            </span>
                          </div>
                          <p className="ai-lead-summary">{item.summary}</p>
                          {item.extractedKeywords && item.extractedKeywords.length > 0 && (
                            <div className="ai-lead-keywords">
                              {item.extractedKeywords.map((kw, i) => (
                                <span key={i} className="keyword-pill">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <a
                            href={`https://instagram.com/p/${item.postId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                          >
                            View Post 🔗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Distribution Breakdown */}
            <div className="glass-card breakdowns-panel">
              <h2 className="card-title">📊 Intelligence Distributions</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#fff" }}>Niche Categories</h3>
                  <div className="breakdown-list">
                    {aiStats.categories.length === 0 ? (
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No category breakdown available.</p>
                    ) : (
                      aiStats.categories.map((cat) => {
                        const pct = totalCategoriesCount > 0 ? (cat.count / totalCategoriesCount) * 100 : 0;
                        return (
                          <div key={cat._id} className="breakdown-item">
                            <div className="breakdown-labels">
                              <span style={{ textTransform: "capitalize" }}>{cat._id}</span>
                              <span>
                                {cat.count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="breakdown-meter-bg">
                              <div className="breakdown-meter-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#fff" }}>Lead Intent Profile</h3>
                  <div className="breakdown-list">
                    {aiStats.intents.length === 0 ? (
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No intent breakdown available.</p>
                    ) : (
                      aiStats.intents.map((intent) => {
                        const pct = totalIntentsCount > 0 ? (intent.count / totalIntentsCount) * 100 : 0;
                        return (
                          <div key={intent._id} className="breakdown-item">
                            <div className="breakdown-labels">
                              <span>{intentDisplayNames[intent._id] || intent._id}</span>
                              <span>
                                {intent.count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="breakdown-meter-bg">
                              <div className="breakdown-meter-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
