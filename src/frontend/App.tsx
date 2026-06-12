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

export default function App() {
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

  // Initial load and filter reload
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300); // Debounce updates by 300ms

    return () => clearTimeout(timer);
  }, [fetchLeads]);

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
          // Wait a moment and refresh leads
          setTimeout(() => {
            fetchLeads();
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
  }, [activeJobId, fetchLeads]);

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

      {/* Main Grid */}
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
    </div>
  );
}
