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

interface UserIntelligenceResult {
  _id: string;
  username: string;
  overallCategory: string;
  overallIntent: string;
  confidence: number;
  leadScore: number;
  summary: string;
  postCountAnalyzed: number;
  leadPostCount: number;
  categories: { category: string; count: number }[];
  intents: { intent: string; count: number }[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  analyzedAt: string;
}

interface UserDetailResponse {
  intelligence: UserIntelligenceResult;
  lead: Lead | null;
  analyses: PostAnalysisResult[];
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
  const [activeTab, setActiveTab] = useState<"pipeline" | "ai" | "user" | "search" | "monitoring">("pipeline");

  // Telemetry Monitoring State
  const [monitoringConfigs, setMonitoringConfigs] = useState<any[]>([]);
  const [trendingLeads, setTrendingLeads] = useState<any[]>([]);
  const [recentlyActive, setRecentlyActive] = useState<any[]>([]);
  const [changeEvents, setChangeEvents] = useState<any[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  // Single User History State (Timeline Modal)
  const [historyUsername, setHistoryUsername] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Semantic Search Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  // User Intelligence Tab State
  const [usersAnalysis, setUsersAnalysis] = useState<UserIntelligenceResult[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetailResponse | null>(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [selectedUserError, setSelectedUserError] = useState<string | null>(null);

  // User Filters
  const [filterUserCategory, setFilterUserCategory] = useState("");
  const [filterUserIntent, setFilterUserIntent] = useState("");
  const [filterUserMinScore, setFilterUserMinScore] = useState("");

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

  // Fetch User Intelligence Data
  const fetchUsersData = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterUserCategory) queryParams.append("category", filterUserCategory);
      if (filterUserIntent) queryParams.append("intent", filterUserIntent);
      if (filterUserMinScore.trim()) queryParams.append("minScore", filterUserMinScore.trim());

      const res = await fetch(`${API_BASE_URL}/users/intelligence?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch user intelligence: ${res.statusText}`);
      }
      const data = await res.json();
      setUsersAnalysis(data);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Error fetching user intelligence profiles");
    } finally {
      setUsersLoading(false);
    }
  }, [filterUserCategory, filterUserIntent, filterUserMinScore]);

  // Fetch Single User details
  const fetchSingleUserDetails = useCallback(async (username: string) => {
    setSelectedUser(username);
    setSelectedUserLoading(true);
    setSelectedUserError(null);
    setSelectedUserDetails(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users/intelligence/${username}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch details for @${username}: ${res.statusText}`);
      }
      const data = await res.json();
      setSelectedUserDetails(data);
    } catch (err) {
      setSelectedUserError(err instanceof Error ? err.message : `Error fetching details for @${username}`);
    } finally {
      setSelectedUserLoading(false);
    }
  }, []);

  // Fetch Semantic Search Results
  const fetchSearchResults = useCallback(async (queryStr: string) => {
    if (!queryStr.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(queryStr.trim())}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch search results: ${res.statusText}`);
      }
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error performing semantic search");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSearchResults(searchQuery);
  };

  // Fetch Monitoring Telemetry Data
  const fetchMonitoringData = useCallback(async () => {
    setMonitoringLoading(true);
    setMonitoringError(null);
    try {
      const [configsRes, trendingRes, activeRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/monitoring`),
        fetch(`${API_BASE_URL}/monitoring/trending`),
        fetch(`${API_BASE_URL}/monitoring/recent-activity`),
        fetch(`${API_BASE_URL}/monitoring/change-events`),
      ]);

      if (!configsRes.ok || !trendingRes.ok || !activeRes.ok || !eventsRes.ok) {
        throw new Error("Failed to load monitoring dataset from backend");
      }

      const [configs, trending, active, events] = await Promise.all([
        configsRes.json(),
        trendingRes.json(),
        activeRes.json(),
        eventsRes.json(),
      ]);

      setMonitoringConfigs(configs);
      setTrendingLeads(trending);
      setRecentlyActive(active);
      setChangeEvents(events);
    } catch (err) {
      setMonitoringError(err instanceof Error ? err.message : "Error fetching monitoring telemetry");
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  // Fetch Single User History
  const fetchUserHistory = useCallback(async (username: string) => {
    setHistoryUsername(username);
    setHistoryLoading(true);
    setHistoryError(null);
    setUserHistory(null);
    try {
      const res = await fetch(`${API_BASE_URL}/monitoring/${username}/history`);
      if (!res.ok) {
        throw new Error(`Failed to fetch score history for @${username}`);
      }
      const data = await res.json();
      setUserHistory(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : `Error fetching score history for @${username}`);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Toggle user monitoring configuration
  const handleToggleMonitoring = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/monitoring/${username}/toggle`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to toggle monitoring configurations for @${username}`);
      }
      // Re-fetch datasets
      fetchMonitoringData();
      fetchUsersData();
    } catch (err) {
      console.error("Toggle monitoring failed:", err);
    }
  };

  // Monitoring load and reload
  useEffect(() => {
    if (activeTab === "monitoring") {
      fetchMonitoringData();
    }
  }, [activeTab, fetchMonitoringData]);

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

  // User intelligence load and filter reload
  useEffect(() => {
    if (activeTab === "user") {
      const timer = setTimeout(() => {
        fetchUsersData();
      }, 300); // Debounce updates by 300ms
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchUsersData]);

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
          // Wait a moment and refresh leads, AI data, and user intelligence data
          setTimeout(() => {
            fetchLeads();
            fetchAiData();
            fetchUsersData();
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
  }, [activeJobId, fetchLeads, fetchAiData, fetchUsersData]);

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
        <button
          className={`tab-btn ${activeTab === "user" ? "active" : ""}`}
          onClick={() => setActiveTab("user")}
        >
          👤 User Intelligence
        </button>
        <button
          className={`tab-btn ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          🔍 Semantic Search
        </button>
        <button
          className={`tab-btn ${activeTab === "monitoring" ? "active" : ""}`}
          onClick={() => setActiveTab("monitoring")}
        >
          📈 Lead Monitoring
        </button>
      </div>

      {activeTab === "pipeline" && (
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
      )}

      {activeTab === "ai" && (
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

      {activeTab === "user" && (
        /* User Intelligence Dashboard */
        <div className="ai-dashboard animate-slide-in">
          {/* Stats Row */}
          <div className="ai-stats-row">
            <div className="stat-card">
              <span className="stat-card-label">Total Lead Profiles</span>
              <span className="stat-card-value">{usersAnalysis.length}</span>
              <span className="stat-card-desc">Unique users analyzed</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">High-Quality Users</span>
              <span className="stat-card-value">
                {usersAnalysis.filter((u) => u.leadScore >= 80).length}
              </span>
              <span className="stat-card-desc">Score &gt;= 80</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Dominant Niche</span>
              <span className="stat-card-value" style={{ fontSize: "1.2rem", textTransform: "capitalize" }}>
                {
                  usersAnalysis.map(u => u.overallCategory).reduce((acc, cat, _, arr) => {
                    if (!cat || cat === "general") return acc;
                    const count = arr.filter(x => x === cat).length;
                    return count > acc.count ? { cat, count } : acc;
                  }, { cat: "N/A", count: 0 }).cat
                }
              </span>
              <span className="stat-card-desc">Highest volume category</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Total Lead Posts</span>
              <span className="stat-card-value">
                {usersAnalysis.reduce((acc, u) => acc + (u.leadPostCount || 0), 0)}
              </span>
              <span className="stat-card-desc">Total positive lead indicators</span>
            </div>
          </div>

          <div className="ai-main-layout">
            {/* Left Column: Filters and Grid */}
            <div className="ai-left-column" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Filters Card */}
              <div className="glass-card card-filters">
                <div className="filters-header">
                  <h2 className="card-title">🎛️ Filter User Intelligence</h2>
                </div>
                <div className="filters-grid">
                  <div className="input-group">
                    <label htmlFor="userCategory">Category</label>
                    <select
                      id="userCategory"
                      value={filterUserCategory}
                      onChange={(e) => setFilterUserCategory(e.target.value)}
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
                    <label htmlFor="userIntent">Intent</label>
                    <select
                      id="userIntent"
                      value={filterUserIntent}
                      onChange={(e) => setFilterUserIntent(e.target.value)}
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
                    <label htmlFor="userMinScore">Min Lead Score</label>
                    <input
                      id="userMinScore"
                      type="number"
                      placeholder="e.g. 50"
                      value={filterUserMinScore}
                      onChange={(e) => setFilterUserMinScore(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* User List */}
              <div className="glass-card card-table" style={{ padding: "1.5rem" }}>
                <h2 className="card-title">👤 Unified Lead Profiles</h2>

                {usersLoading && (
                  <div className="table-loading-container">
                    <div className="spinner"></div>
                    <p>Aggregating user intelligence profiles...</p>
                  </div>
                )}

                {usersError && <div className="toast toast-error">{usersError}</div>}

                {!usersLoading && !usersError && usersAnalysis.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>No User Profiles Match Your Criteria</h3>
                    <p>Ensure your scraper is active and AI-analyzed posts are being aggregated by the background worker.</p>
                  </div>
                )}

                {!usersLoading && !usersError && usersAnalysis.length > 0 && (
                  <div className="ai-leads-grid">
                    {usersAnalysis.map((item) => (
                      <div key={item._id} className="ai-lead-card">
                        <div className={getScoreBadgeClass(item.leadScore)}>
                          {item.leadScore}
                        </div>
                        <div className="ai-lead-details">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="ai-lead-user" style={{ fontSize: "1.2rem" }}>
                              @{item.username}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                              Updated {new Date(item.analyzedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="ai-lead-meta">
                            <span className={getCategoryBadgeClass(item.overallCategory)}>
                              {item.overallCategory}
                            </span>
                            <span className="ai-intent-badge">
                              {intentDisplayNames[item.overallIntent] || item.overallIntent}
                            </span>
                            <span className="ai-intent-badge" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                              📑 Posts: {item.postCountAnalyzed} ({item.leadPostCount} leads)
                            </span>
                          </div>
                          <p className="ai-lead-summary">{item.summary}</p>
                        </div>
                        <div>
                          <button
                            onClick={() => fetchSingleUserDetails(item.username)}
                            className="btn btn-primary"
                            style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                          >
                            Inspect Profile 👤
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Breakdown */}
            <div className="glass-card breakdowns-panel">
              <h2 className="card-title">📊 Lead Profile Distribution</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#fff" }}>Niche Categories</h3>
                  <div className="breakdown-list">
                    {
                      (() => {
                        const totalUsersCat = usersAnalysis.length;
                        const catDist = usersAnalysis.reduce((acc: Record<string, number>, u) => {
                          acc[u.overallCategory] = (acc[u.overallCategory] || 0) + 1;
                          return acc;
                        }, {});
                        const sortedCats = Object.entries(catDist).map(([category, count]) => ({ category, count })).sort((a,b) => b.count - a.count);

                        if (sortedCats.length === 0) {
                          return <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No users analyzed yet.</p>;
                        }

                        return sortedCats.map((cat) => {
                          const pct = totalUsersCat > 0 ? (cat.count / totalUsersCat) * 100 : 0;
                          return (
                            <div key={cat.category} className="breakdown-item">
                              <div className="breakdown-labels">
                                <span style={{ textTransform: "capitalize" }}>{cat.category}</span>
                                <span>
                                  {cat.count} ({pct.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="breakdown-meter-bg">
                                <div className="breakdown-meter-fill" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    }
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#fff" }}>Dominant Intent Profile</h3>
                  <div className="breakdown-list">
                    {
                      (() => {
                        const totalUsersInt = usersAnalysis.length;
                        const intDist = usersAnalysis.reduce((acc: Record<string, number>, u) => {
                          acc[u.overallIntent] = (acc[u.overallIntent] || 0) + 1;
                          return acc;
                        }, {});
                        const sortedInts = Object.entries(intDist).map(([intent, count]) => ({ intent, count })).sort((a,b) => b.count - a.count);

                        if (sortedInts.length === 0) {
                          return <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No users analyzed yet.</p>;
                        }

                        return sortedInts.map((intent) => {
                          const pct = totalUsersInt > 0 ? (intent.count / totalUsersInt) * 100 : 0;
                          return (
                            <div key={intent.intent} className="breakdown-item">
                              <div className="breakdown-labels">
                                <span>{intentDisplayNames[intent.intent] || intent.intent}</span>
                                <span>
                                  {intent.count} ({pct.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="breakdown-meter-bg">
                                <div className="breakdown-meter-fill" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              position: "relative",
              animation: "fade-in 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedUser(null)}
              style={{
                position: "absolute",
                top: "1.5rem",
                right: "1.5rem",
                background: "rgba(255, 255, 255, 0.08)",
                border: "var(--glass-border)",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>

            <h2 className="card-title" style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>
              👤 Unified Lead Profile: @{selectedUser}
            </h2>

            {selectedUserLoading && (
              <div className="table-loading-container" style={{ margin: "3rem 0" }}>
                <div className="spinner"></div>
                <p>Generating unified profile...</p>
              </div>
            )}

            {selectedUserError && <div className="toast toast-error">{selectedUserError}</div>}

            {selectedUserDetails && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {/* Unified profile info */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "1.5rem",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    paddingBottom: "1.5rem",
                  }}
                >
                  <div className={getScoreBadgeClass(selectedUserDetails.intelligence.leadScore)}>
                    {selectedUserDetails.intelligence.leadScore}
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <span className={getCategoryBadgeClass(selectedUserDetails.intelligence.overallCategory)}>
                        {selectedUserDetails.intelligence.overallCategory}
                      </span>
                      <span className="ai-intent-badge">
                        {intentDisplayNames[selectedUserDetails.intelligence.overallIntent] ||
                          selectedUserDetails.intelligence.overallIntent}
                      </span>
                      <span className="ai-intent-badge" style={{ background: "rgba(159, 62, 255, 0.1)" }}>
                        🎯 Confidence: {selectedUserDetails.intelligence.confidence.toFixed(0)}%
                      </span>
                      <span className="ai-intent-badge" style={{ background: "rgba(0, 216, 255, 0.1)" }}>
                        📚 Posts: {selectedUserDetails.intelligence.postCountAnalyzed} ({selectedUserDetails.intelligence.leadPostCount} leads)
                      </span>
                    </div>

                    {selectedUserDetails.lead && (
                      <div style={{ color: "#fff", marginBottom: "0.5rem" }}>
                        <strong>Name:</strong> {selectedUserDetails.lead.fullName || "N/A"} |{" "}
                        <strong>Followers:</strong> {selectedUserDetails.lead.followerCount.toLocaleString()}
                        {selectedUserDetails.lead.contactEmail && (
                          <span> | <strong>Email:</strong> {selectedUserDetails.lead.contactEmail}</span>
                        )}
                      </div>
                    )}

                    {selectedUserDetails.intelligence.firstSeenAt && (
                      <div style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                        Timeframe: {new Date(selectedUserDetails.intelligence.firstSeenAt).toLocaleDateString()} –{" "}
                        {new Date(selectedUserDetails.intelligence.lastSeenAt || "").toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                <div>
                  <h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "0.5rem" }}>AI Executive Summary</h3>
                  <p
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "var(--glass-border)",
                      borderRadius: "8px",
                      padding: "1rem",
                      color: "#fff",
                      lineHeight: "1.5",
                      fontSize: "0.95rem",
                    }}
                  >
                    {selectedUserDetails.intelligence.summary}
                  </p>
                </div>

                {/* Post Analyses */}
                <div>
                  <h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>Post Activity Details</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {selectedUserDetails.analyses.map((analysis) => (
                      <div
                        key={analysis._id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "var(--glass-border)",
                          borderRadius: "8px",
                          padding: "1rem",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "1rem",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span className="niche-badge" style={{ fontSize: "0.7rem" }}>
                              {analysis.category}
                            </span>
                            <span className="ai-intent-badge" style={{ fontSize: "0.7rem" }}>
                              {intentDisplayNames[analysis.intent] || analysis.intent}
                            </span>
                            <span
                              style={{
                                color: analysis.leadScore >= 80 ? "#d19eff" : "#a4f2ff",
                                fontWeight: "bold",
                                fontSize: "0.8rem",
                              }}
                            >
                              Score: {analysis.leadScore}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.9rem", color: "#fff", margin: 0 }}>{analysis.summary}</p>
                          {analysis.extractedKeywords && analysis.extractedKeywords.length > 0 && (
                            <div className="ai-lead-keywords" style={{ marginTop: "0.2rem" }}>
                              {analysis.extractedKeywords.map((kw, i) => (
                                <span key={i} className="keyword-pill">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <a
                            href={`https://instagram.com/p/${analysis.postId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                          >
                            Post 🔗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "search" && (
        <div className="ai-dashboard animate-slide-in">
          {/* Stats Row */}
          <div className="ai-stats-row">
            <div className="stat-card">
              <span className="stat-card-label">Query</span>
              <span className="stat-card-value" style={{ fontSize: "1.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {searchQuery || "None"}
              </span>
              <span className="stat-card-desc">Active search phrase</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Matches Found</span>
              <span className="stat-card-value">
                {searchResults.length}
              </span>
              <span className="stat-card-desc">Unique relevant users</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Max Similarity</span>
              <span className="stat-card-value">
                {searchResults.length > 0 ? `${(searchResults[0].similarity * 100).toFixed(0)}%` : "0%"}
              </span>
              <span className="stat-card-desc">Highest cosine score</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Top Category</span>
              <span className="stat-card-value" style={{ fontSize: "1.2rem", textTransform: "capitalize" }}>
                {searchResults[0]?.category || "N/A"}
              </span>
              <span className="stat-card-desc">Category of best match</span>
            </div>
          </div>

          {/* Search Input Card */}
          <div className="glass-card" style={{ padding: "2rem", marginBottom: "2rem" }}>
            <h2 className="card-title">🔍 Semantic Lead Search Engine</h2>
            <p style={{ color: "var(--color-text-dim)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              Search for prospects by intent and meaning rather than keywords. Example: <em>"people looking for skin treatment"</em> or <em>"hiring developer"</em>.
            </p>
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "1rem" }}>
              <input
                type="text"
                placeholder="Describe who or what you are looking for..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "var(--glass-border)",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "0.75rem 1rem",
                  fontSize: "1.1rem",
                  fontFamily: "var(--font-sans)",
                }}
              />
              <button
                type="submit"
                className={`btn btn-primary ${searchLoading ? "loading" : ""}`}
                disabled={searchLoading}
                style={{ minWidth: "150px" }}
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </form>
            {searchError && <div className="toast toast-error" style={{ marginTop: "1rem" }}>{searchError}</div>}
          </div>

          {/* Results Grid */}
          <div className="glass-card card-table" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 className="card-title" style={{ margin: 0 }}>🎯 Semantic Matches</h2>
              {searchResults.length > 0 && (
                <span style={{ fontSize: "0.9rem", color: "var(--color-text-dim)" }}>
                  Found {searchResults.length} matches (capped at 50)
                </span>
              )}
            </div>

            {searchLoading && (
              <div className="table-loading-container" style={{ margin: "3rem 0" }}>
                <div className="spinner"></div>
                <p>Generating query vector & computing cosine similarities...</p>
              </div>
            )}

            {!searchLoading && !searchError && searchResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>No Semantic Results to Display</h3>
                <p>Type a search query above and hit Search to find matched leads by meaning.</p>
              </div>
            )}

            {!searchLoading && !searchError && searchResults.length > 0 && (
              <div className="ai-leads-grid">
                {searchResults.map((item) => (
                  <div key={item.postId} className="ai-lead-card">
                    {/* Similarity and Score Badge */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
                      <div className={getScoreBadgeClass(item.leadScore)} title="Lead Score">
                        {item.leadScore}
                      </div>
                      <div style={{ 
                        fontSize: "0.8rem", 
                        fontWeight: "bold", 
                        color: "#a4f2ff", 
                        background: "rgba(164, 242, 255, 0.1)", 
                        padding: "0.2rem 0.5rem", 
                        borderRadius: "12px",
                        textAlign: "center"
                      }}>
                        {(item.similarity * 100).toFixed(1)}% Sim
                      </div>
                    </div>
                    
                    {/* Lead details */}
                    <div className="ai-lead-details">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="ai-lead-user" style={{ fontSize: "1.2rem" }}>
                          @{item.username}
                        </span>
                      </div>
                      
                      <div className="ai-lead-meta" style={{ marginTop: "0.5rem" }}>
                        <span className={getCategoryBadgeClass(item.category)}>
                          {item.category}
                        </span>
                        <span className="ai-intent-badge">
                          {intentDisplayNames[item.intent] || item.intent}
                        </span>
                      </div>
                      
                      <div style={{ marginTop: "1rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", textTransform: "uppercase", fontWeight: "bold" }}>
                          User Summary:
                        </span>
                        <p className="ai-lead-summary" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
                          {item.summary}
                        </p>
                      </div>

                      <div style={{
                        marginTop: "0.5rem",
                        padding: "0.75rem",
                        background: "rgba(0, 0, 0, 0.2)",
                        borderLeft: "3px solid var(--color-primary, #9f3eff)",
                        borderRadius: "0 8px 8px 0"
                      }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", textTransform: "uppercase", fontWeight: "bold" }}>
                          Best Match Caption:
                        </span>
                        <p style={{ fontSize: "0.9rem", color: "#fff", margin: "0.25rem 0 0 0", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                          "{item.caption}"
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <button
                        onClick={() => fetchSingleUserDetails(item.username)}
                        className="btn btn-primary"
                        style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                      >
                        Inspect Profile 👤
                      </button>
                      <a
                        href={`https://instagram.com/p/${item.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem", whiteSpace: "nowrap", textAlign: "center" }}
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
      )}

      {activeTab === "monitoring" && (
        <div className="ai-dashboard animate-slide-in">
          {/* Stats Row */}
          <div className="ai-stats-row">
            <div className="stat-card">
              <span className="stat-card-label">Monitored Users</span>
              <span className="stat-card-value">
                {monitoringConfigs.filter((c) => c.monitoringEnabled).length} / {monitoringConfigs.length}
              </span>
              <span className="stat-card-desc">Active monitoring profiles</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Trending Leads</span>
              <span className="stat-card-value">
                {trendingLeads.filter((t) => t.scoreIncrease > 0).length}
              </span>
              <span className="stat-card-desc">Users with positive score growth</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Total Re-checks</span>
              <span className="stat-card-value">
                {monitoringConfigs.reduce((sum, c) => sum + (c.totalChecks || 0), 0)}
              </span>
              <span className="stat-card-desc">Scrapes executed by scheduler</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Changes Detected</span>
              <span className="stat-card-value">
                {monitoringConfigs.reduce((sum, c) => sum + (c.totalChangesDetected || 0), 0)}
              </span>
              <span className="stat-card-desc">New activity & index shifts</span>
            </div>
          </div>

          <div className="ai-main-layout">
            {/* Left Column: Trending and Configurations */}
            <div className="ai-left-column" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              
              {/* Trending Leads */}
              <div className="glass-card" style={{ padding: "1.5rem" }}>
                <h2 className="card-title">📈 Top Rising Leads</h2>
                
                {monitoringLoading && (
                  <div className="table-loading-container" style={{ margin: "2rem 0" }}>
                    <div className="spinner"></div>
                    <p>Loading trending analytics...</p>
                  </div>
                )}

                {monitoringError && <div className="toast toast-error">{monitoringError}</div>}

                {!monitoringLoading && !monitoringError && trendingLeads.length === 0 && (
                  <p style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "2rem 0" }}>
                    No trending telemetry available. Run more checks to see score progression.
                  </p>
                )}

                {!monitoringLoading && !monitoringError && trendingLeads.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {trendingLeads.slice(0, 10).map((lead) => (
                      <div key={lead.username} className="ai-lead-card" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div className={getScoreBadgeClass(lead.currentScore)}>
                            {lead.currentScore}
                          </div>
                          {lead.scoreIncrease > 0 ? (
                            <span style={{ 
                              color: "#8effd0", 
                              background: "rgba(16, 185, 129, 0.15)", 
                              padding: "0.2rem 0.6rem", 
                              borderRadius: "12px", 
                              fontSize: "0.8rem", 
                              fontWeight: "bold",
                              marginTop: "0.5rem" 
                            }}>
                              +{lead.scoreIncrease} Growth
                            </span>
                          ) : (
                            <span style={{ 
                              color: "var(--color-text-dim)", 
                              background: "rgba(255, 255, 255, 0.05)", 
                              padding: "0.2rem 0.6rem", 
                              borderRadius: "12px", 
                              fontSize: "0.8rem", 
                              marginTop: "0.5rem" 
                            }}>
                              Stable
                            </span>
                          )}
                        </div>

                        <div className="ai-lead-details">
                          <span className="ai-lead-user" style={{ fontSize: "1.2rem" }}>
                            @{lead.username}
                          </span>
                          <div className="ai-lead-meta" style={{ marginTop: "0.5rem" }}>
                            <span className={getCategoryBadgeClass(lead.category)}>
                              {lead.category}
                            </span>
                            <span className="ai-intent-badge">
                              {intentDisplayNames[lead.intent] || lead.intent}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                            Last updated {new Date(lead.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <button
                            onClick={() => fetchUserHistory(lead.username)}
                            className="btn btn-primary"
                            style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}
                          >
                            Timeline 📊
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monitoring Config list */}
              <div className="glass-card card-table" style={{ padding: "1.5rem" }}>
                <h2 className="card-title">⚙️ Monitoring Status Configuration</h2>
                
                {monitoringConfigs.length === 0 ? (
                  <p style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "2rem 0" }}>
                    No configurations found. Add profile intelligence aggregated to initialize.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Status</th>
                          <th>Last Checked</th>
                          <th>Checks Run</th>
                          <th>Changes</th>
                          <th>Settings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitoringConfigs.map((config) => (
                          <tr key={config.username} className="lead-row">
                            <td style={{ fontWeight: "bold" }}>@{config.username}</td>
                            <td>
                              <span className={`status-badge ${config.monitoringEnabled ? "status-completed" : "status-failed"}`}>
                                {config.monitoringEnabled ? "ENABLED" : "PAUSED"}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.85rem", color: "var(--color-text-dim)" }}>
                                {config.lastCheckedAt && new Date(config.lastCheckedAt).getTime() > 0
                                  ? new Date(config.lastCheckedAt).toLocaleString()
                                  : "Never"}
                              </span>
                            </td>
                            <td>{config.totalChecks}</td>
                            <td>{config.totalChangesDetected}</td>
                            <td>
                              <button
                                onClick={() => handleToggleMonitoring(config.username)}
                                className={`btn ${config.monitoringEnabled ? "btn-secondary" : "btn-primary"}`}
                                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                              >
                                {config.monitoringEnabled ? "Pause" : "Monitor"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Activity Log and transition feeds */}
            <div className="glass-card breakdowns-panel" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div>
                <h2 className="card-title">🚨 Recent Activity Alerts</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {recentlyActive.length === 0 ? (
                    <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No recent activity detected.</p>
                  ) : (
                    recentlyActive.map((act) => (
                      <div key={act.username} style={{ 
                        background: "rgba(255, 255, 255, 0.02)", 
                        border: "var(--glass-border)", 
                        borderRadius: "8px", 
                        padding: "0.75rem 1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <strong style={{ display: "block" }}>@{act.username}</strong>
                          <span style={{ fontSize: "0.85rem", color: "#8effd0" }}>
                            📥 {act.newPostsCount} new posts scraped
                          </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                          {new Date(act.detectedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h2 className="card-title">⚡ Change & Transition Log</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "500px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {changeEvents.length === 0 ? (
                    <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No change events recorded.</p>
                  ) : (
                    changeEvents.map((evt) => (
                      <div key={evt._id} style={{ 
                        background: "rgba(159, 62, 255, 0.02)", 
                        border: "1px solid rgba(159, 62, 255, 0.1)", 
                        borderRadius: "8px", 
                        padding: "0.75rem 1rem",
                        fontSize: "0.9rem"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                          <span style={{ fontWeight: "bold" }}>@{evt.username}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                            {new Date(evt.detectedAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {evt.changeType === "lead_score_increase" && (
                          <div style={{ color: "#d19eff" }}>
                            🚀 Lead Score Increased: <strong>{evt.oldValue}</strong> → <strong>{evt.newValue}</strong> (+{evt.delta})
                          </div>
                        )}

                        {evt.changeType === "category_change" && (
                          <div style={{ color: "#a4f2ff" }}>
                            🏷️ Category Shifted: <span className="niche-badge" style={{ fontSize: "0.7rem" }}>{evt.oldValue}</span> → <span className="niche-badge" style={{ fontSize: "0.7rem", background: "rgba(0, 216, 255, 0.2)" }}>{evt.newValue}</span>
                          </div>
                        )}

                        {evt.changeType === "intent_change" && (
                          <div style={{ color: "#ffcf8a" }}>
                            🤝 Intent Transition: <span style={{ fontSize: "0.85rem", textTransform: "capitalize", opacity: 0.8 }}>{evt.oldValue}</span> → <strong>{intentDisplayNames[evt.newValue || ""] || evt.newValue}</strong>
                          </div>
                        )}

                        {evt.changeType === "new_posts" && (
                          <div style={{ color: "#8effd0" }}>
                            📝 Content Scraped: <strong>{evt.delta} new posts</strong> enqueued for AI intelligence
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score History Timeline Modal */}
      {historyUsername && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => setHistoryUsername(null)}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "2rem",
              position: "relative",
              animation: "fade-in 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setHistoryUsername(null)}
              style={{
                position: "absolute",
                top: "1.5rem",
                right: "1.5rem",
                background: "rgba(255, 255, 255, 0.08)",
                border: "var(--glass-border)",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>

            <h2 className="card-title">📈 Monitoring Timeline: @{historyUsername}</h2>

            {historyLoading && (
              <div className="table-loading-container" style={{ margin: "2rem 0" }}>
                <div className="spinner"></div>
                <p>Generating score timeline...</p>
              </div>
            )}

            {historyError && <div className="toast toast-error">{historyError}</div>}

            {userHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                
                {/* Custom Visual Score Timeline Chart */}
                <div>
                  <h3 style={{ fontSize: "1rem", color: "#fff", marginBottom: "1rem" }}>Lead Score Progression</h3>
                  {userHistory.history.length === 0 ? (
                    <p style={{ color: "var(--color-text-dim)" }}>No historical scores recorded yet.</p>
                  ) : (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "flex-end", 
                      justifyContent: "space-between", 
                      height: "150px", 
                      padding: "1rem 0",
                      background: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "8px",
                      border: "var(--glass-border)"
                    }}>
                      {userHistory.history.map((hist: any, index: number) => (
                        <div key={index} style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          alignItems: "center",
                          flex: 1
                        }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#fff", marginBottom: "0.4rem" }}>
                            {hist.leadScore}
                          </span>
                          <div style={{ 
                            width: "12px", 
                            height: `${hist.leadScore}%`, 
                            maxHeight: "100px",
                            background: hist.leadScore >= 80 ? "linear-gradient(180deg, var(--color-primary) 0%, #7c22e4 100%)" : "linear-gradient(180deg, var(--color-accent) 0%, #00a2cc 100%)", 
                            borderRadius: "6px 6px 0 0",
                            boxShadow: "0 0 10px rgba(159, 62, 255, 0.2)"
                          }}></div>
                          <span style={{ fontSize: "0.65rem", color: "var(--color-text-dim)", marginTop: "0.4rem" }}>
                            {new Date(hist.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score Log Timeline Feed */}
                <div>
                  <h3 style={{ fontSize: "1rem", color: "#fff", marginBottom: "1rem" }}>Telemetry Event History</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "200px", overflowY: "auto" }}>
                    {userHistory.events.length === 0 ? (
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No monitored events recorded.</p>
                    ) : (
                      userHistory.events.map((evt: any) => (
                        <div key={evt._id} style={{ 
                          fontSize: "0.85rem", 
                          padding: "0.5rem 0.75rem", 
                          background: "rgba(255, 255, 255, 0.02)", 
                          borderRadius: "6px",
                          border: "var(--glass-border)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-dim)", fontSize: "0.75rem" }}>
                            <span>Event: {evt.changeType.replace(/_/g, " ").toUpperCase()}</span>
                            <span>{new Date(evt.detectedAt).toLocaleDateString()}</span>
                          </div>
                          <p style={{ margin: "0.25rem 0 0 0", color: "#fff" }}>
                            {evt.changeType === "lead_score_increase" && `Lead score grew by +${evt.delta} (from ${evt.oldValue} to ${evt.newValue})`}
                            {evt.changeType === "category_change" && `Category shifted from ${evt.oldValue} to ${evt.newValue}`}
                            {evt.changeType === "intent_change" && `Intent shifted from ${evt.oldValue} to ${evt.newValue}`}
                            {evt.changeType === "new_posts" && `Sourced ${evt.delta} new posts for lead profiling`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
