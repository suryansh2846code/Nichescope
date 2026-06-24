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
  progress: number | {
    percent: number;
    stage?: string;
    currentKeyword?: string;
    currentUsername?: string;
    currentIndex?: number;
    totalCount?: number;
    added: number;
    skipped: number;
  };
  data: {
    username?: string;
    hashtag?: string;
    niche?: string;
  };
  attemptsMade: number;
  failedReason?: string;
  returnvalue?: any;
  processedOn?: number;
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

interface LeadPipelineResult {
  _id: string;
  username: string;
  status: "new" | "contacted" | "interested" | "qualified" | "converted" | "lost";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  notes: { content: string; createdAt: string }[];
  tags: string[];
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  problem: string;
  serviceNeeded: string;
  buyingIntent: number;
  leadScore: number;
}

export default function App() {
  // Navigation
  // const [activeTab, setActiveTab] = useState<"discovery" | "hashtag-discovery" | "qualified" | "crm" | "settings" | "developer" | "logs">("discovery");
  const [activeTab, setActiveTab] = useState<"discovery" | "seed-influencers" | "qualified" | "crm" | "settings" | "developer" | "logs">("discovery");

  // Lead Inbox Tab State
  const [qualifiedLeads, setQualifiedLeads] = useState<any[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [inboxUrgency, setInboxUrgency] = useState("");
  const [inboxCategory, setInboxCategory] = useState("");
  const [inboxMinIntent, setInboxMinIntent] = useState("");
  const [inboxService, setInboxService] = useState("");

  const [selectedInboxLeadUsername, setSelectedInboxLeadUsername] = useState<string | null>(null);
  const [selectedInboxLeadDetails, setSelectedInboxLeadDetails] = useState<any | null>(null);
  const [selectedInboxLeadLoading, setSelectedInboxLeadLoading] = useState(false);
  const [selectedInboxLeadError, setSelectedInboxLeadError] = useState<string | null>(null);

  // CRM Pipeline Tab State
  const [crmLeads, setCrmLeads] = useState<LeadPipelineResult[]>([]);
  const [crmStats, setCrmStats] = useState<any | null>(null);
  const [crmActivity, setCrmActivity] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);

  // CRM Filters
  const [crmFilterStatus, setCrmFilterStatus] = useState("");
  const [crmFilterPriority, setCrmFilterPriority] = useState("");
  const [crmFilterAssignedTo, setCrmFilterAssignedTo] = useState("");

  // CRM Lead Details Drawer/Modal
  const [selectedCrmUsername, setSelectedCrmUsername] = useState<string | null>(null);
  const [selectedCrmDetails, setSelectedCrmDetails] = useState<any | null>(null);
  const [selectedCrmLoading, setSelectedCrmLoading] = useState(false);
  const [selectedCrmError, setSelectedCrmError] = useState<string | null>(null);

  // CRM Form Inputs
  const [noteContent, setNoteContent] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Telemetry Monitoring State
  const [monitoringConfigs, setMonitoringConfigs] = useState<any[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  // Semantic Search Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // // Hashtag Discovery State
  // const [hashtagInput, setHashtagInput] = useState("");
  // const [activeDiscoveryKeyword, setActiveDiscoveryKeyword] = useState("");
  // const [submittingHashtag, setSubmittingHashtag] = useState(false);
  // const [hashtagError, setHashtagError] = useState<string | null>(null);
  // const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  
  // Seed Influencers State
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [newInfluencerUsername, setNewInfluencerUsername] = useState("");
  const [newInfluencerNiche, setNewInfluencerNiche] = useState("");
  const [influencerError, setInfluencerError] = useState<string | null>(null);

  // Seed Influencer Leads Modal State
  const [selectedInfluencerForLeads, setSelectedInfluencerForLeads] = useState<string | null>(null);
  const [influencerLeadsList, setInfluencerLeadsList] = useState<any[]>([]);
  const [influencerLeadsLoading, setInfluencerLeadsLoading] = useState(false);
  const [influencerLeadsError, setInfluencerLeadsError] = useState<string | null>(null);

  // Job Tracker State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [queueStats, setQueueStats] = useState<any | null>(null);

  // System Settings State
  const [sysSettings, setSysSettings] = useState<any>({
    maxPostsScraped: 5,
    maxHashtagPosts: 50,
    maxCommentsScraped: 20,
    followingBoostWeight: 30,
    intentThreshold: 60,
    immediateContactThreshold: 85,
    aiProvider: "gemini",
    geminiApiKey: "",
    openaiApiKey: "",
    openrouterApiKey: "",
    temperature: 0.2,
  });
  const [sysSettingsLoading, setSysSettingsLoading] = useState(false);
  const [sysSettingsError, setSysSettingsError] = useState<string | null>(null);
  const [sysSettingsSaveSuccess, setSysSettingsSaveSuccess] = useState<string | null>(null);

  // Developer Mode State
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    return localStorage.getItem("isDevMode") === "true";
  });
  const [devUsername, setDevUsername] = useState("");
  const [devScenario, setDevScenario] = useState("success");
  const [devSubmitting, setDevSubmitting] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [devSuccessMessage, setDevSuccessMessage] = useState<string | null>(null);

  // Logs Tab State
  const [selectedWorker, setSelectedWorker] = useState<"scraper" | "influencer-discovery" | "comment-scraper" | "comment-analyzer" | "analysis" | "embedding" | "intelligence" | "qualification">("scraper");
  const [workerLogs, setWorkerLogs] = useState<any[]>([]);
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(true);
  const [logsSearchTerm, setLogsSearchTerm] = useState("");

  const fetchWorkerLogs = useCallback(async (workerName: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/logs/${workerName}?limit=150`);
      if (res.ok) {
        const data = await res.json();
        setWorkerLogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, []);

  const handleClearLogs = async (workerName: string) => {
    if (!confirm(`Are you sure you want to clear all log history for "${workerName}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/logs/clear/${workerName}`, { method: "POST" });
      if (res.ok) {
        setWorkerLogs([]);
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  // Add to CRM Handler
  const handleAddToCrm = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "new" })
      });
      if (!res.ok) throw new Error("Failed to add lead to CRM");
      alert(`Successfully added @${username} to CRM Pipeline!`);
      fetchCrmData();
      fetchInboxLeads();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding to CRM");
    }
  };

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

  // const fetchDiscoveredUsers = async (hashtag: string) => {
  //   try {
  //     const res = await fetch(`${API_BASE_URL}/discover/hashtag/${encodeURIComponent(hashtag)}`);
  //     if (!res.ok) throw new Error("Failed to fetch discovered users");
  //     const discoveredList = await res.json() as { username: string }[];
  // 
  //     const qualRes = await fetch(`${API_BASE_URL}/leads/inbox`);
  //     let inboxList: any[] = [];
  //     if (qualRes.ok) {
  //       inboxList = await qualRes.json();
  //     }
  // 
  //     const mapped = discoveredList.map(disc => {
  //       const username = disc.username.toLowerCase();
  //       const q = inboxList.find(i => i.username.toLowerCase() === username);
  //       return {
  //         username: disc.username,
  //         problem: q?.problem || "Processing...",
  //         serviceNeeded: q?.serviceNeeded || "Processing...",
  //         buyingIntent: q?.buyingIntent || 0,
  //         leadScore: q?.leadScore || 0,
  //         recommendedAction: q?.recommendedAction || "Analyzing..."
  //       };
  //     });
  //     setDiscoveredUsers(mapped);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };
  // 
  // const handleHashtagDiscoverySubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setHashtagError(null);
  //   const rawInput = hashtagInput.trim();
  //   if (!rawInput) {
  //     setHashtagError("Hashtag/Keywords are required");
  //     return;
  //   }
  //   console.log("[UI INPUT]", rawInput);
  //   setActiveDiscoveryKeyword(rawInput);
  //   setSubmittingHashtag(true);
  //   try {
  //     const payload = { hashtag: rawInput };
  //     console.log("[UI SUBMIT]", payload);
  //     const res = await fetch(`${API_BASE_URL}/discover/hashtag`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(payload)
  //     });
  //     if (!res.ok) {
  //       const errData = await res.json();
  //       throw new Error(errData.error || `Error starting discovery: ${res.statusText}`);
  //     }
  //     const data = await res.json();
  //     console.log("[UI JOB ID]", data.jobId);
  //     setActiveJobId(data.jobId);
  //     setTimeout(() => {
  //       fetchDiscoveredUsers(rawInput);
  //     }, 3000);
  //   } catch (err) {
  //     setHashtagError(err instanceof Error ? err.message : "Failed to trigger keyword discovery");
  //   } finally {
  //     setSubmittingHashtag(false);
  //   }
  // };

  const fetchInfluencers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers`);
      if (res.ok) {
        const data = await res.json();
        setInfluencers(data);
      }
    } catch (err) {
      console.error("Error fetching influencers:", err);
    }
  }, []);

  const fetchInfluencerLeads = useCallback(async (username: string) => {
    setSelectedInfluencerForLeads(username);
    setInfluencerLeadsLoading(true);
    setInfluencerLeadsError(null);
    setInfluencerLeadsList([]);
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers/${username}/leads`);
      if (!res.ok) {
        throw new Error(`Failed to fetch leads for @${username}`);
      }
      const data = await res.json();
      setInfluencerLeadsList(data);
    } catch (err) {
      setInfluencerLeadsError(err instanceof Error ? err.message : `Error fetching leads for @${username}`);
    } finally {
      setInfluencerLeadsLoading(false);
    }
  }, []);

  const handleAddInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInfluencerUsername.trim() || !newInfluencerNiche.trim()) {
      setInfluencerError("Username and niche are required");
      return;
    }
    setInfluencerError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newInfluencerUsername.trim(),
          niche: newInfluencerNiche.trim()
        })
      });
      if (res.ok) {
        setNewInfluencerUsername("");
        setNewInfluencerNiche("");
        fetchInfluencers();
      } else {
        const err = await res.json();
        setInfluencerError(err.error || "Failed to add influencer");
      }
    } catch (err) {
      setInfluencerError("Network error while adding influencer");
    }
  };

  const handleToggleInfluencer = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers/${username}/toggle`, {
        method: "PATCH"
      });
      if (res.ok) {
        fetchInfluencers();
      }
    } catch (err) {
      console.error("Error toggling influencer:", err);
    }
  };

  const handleDeleteInfluencer = async (username: string) => {
    if (!confirm(`Are you sure you want to delete @${username} from seed list?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers/${username}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchInfluencers();
      }
    } catch (err) {
      console.error("Error deleting influencer:", err);
    }
  };

  const handleRunInfluencer = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers/${username}/run`, {
        method: "POST"
      });
      if (res.ok) {
        alert(`Manually triggered scan for @${username}!`);
        fetchInfluencers();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to trigger scan");
      }
    } catch (err) {
      console.error("Error triggering scan:", err);
      alert("Network error triggering scan");
    }
  };

  const handleTriggerInfluencerScan = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/discover/influencers/trigger`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJobId(data.jobId);
        alert("Manually triggered seed influencer post discovery pipeline!");
      }
    } catch (err) {
      console.error("Error triggering influencer scan:", err);
    }
  };

  const fetchAllJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/jobs`);
      if (!res.ok) {
        throw new Error("Failed to fetch jobs pipeline");
      }
      const data = await res.json();
      setAllJobs(data);
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "Error loading jobs list");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchQueueStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/stats`);
      if (res.ok) {
        const stats = await res.json();
        setQueueStats(stats);
      }
    } catch (err) {
      console.error("Error fetching queue stats:", err);
    }
  }, []);

  const handleTriggerScenarioDirect = async (scenario: string, username: string) => {
    setDevError(null);
    setDevSuccessMessage(null);
    setDevSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dev/trigger-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, username })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to trigger scenario");
      }
      const data = await res.json();
      setDevSuccessMessage(`Scenario "${scenario}" triggered for @${username}! Job ID: ${data.jobId}`);
      setActiveJobId(data.jobId);
      fetchAllJobs();
    } catch (err) {
      setDevError(err instanceof Error ? err.message : "Error triggering scenario");
    } finally {
      setDevSubmitting(false);
    }
  };

  const handleTriggerConcurrencyTest = async () => {
    setDevError(null);
    setDevSuccessMessage(null);
    setDevSubmitting(true);
    try {
      const scenarios = [
        { scenario: "success", username: "concurrent_user_1" },
        { scenario: "success", username: "concurrent_user_2" },
        { scenario: "success", username: "concurrent_user_3" },
        { scenario: "success", username: "concurrent_user_4" },
        { scenario: "success", username: "concurrent_user_5" }
      ];

      const promises = scenarios.map(async ({ scenario, username }) => {
        const res = await fetch(`${API_BASE_URL}/dev/trigger-scenario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, username })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed for @${username}`);
        }
        return res.json();
      });

      await Promise.all(promises);
      setDevSuccessMessage("Successfully triggered 5 parallel mock jobs concurrent run!");
      fetchAllJobs();
    } catch (err) {
      setDevError(err instanceof Error ? err.message : "Error triggering concurrency test");
    } finally {
      setDevSubmitting(false);
    }
  };

  const handleClearQueues = async () => {
    if (!confirm("Are you sure you want to clear/drain both BullMQ queues?")) return;
    setDevError(null);
    setDevSuccessMessage(null);
    setDevSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dev/clear-queues`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear queues");
      setDevSuccessMessage("BullMQ queues successfully drained!");
    } catch (err) {
      setDevError(err instanceof Error ? err.message : "Error clearing queues");
    } finally {
      setDevSubmitting(false);
    }
  };

  // Fetch Monitoring Telemetry Data
  const fetchMonitoringData = useCallback(async () => {
    setMonitoringLoading(true);
    setMonitoringError(null);
    try {
      const configsRes = await fetch(`${API_BASE_URL}/monitoring`);
      if (!configsRes.ok) {
        throw new Error("Failed to load monitoring configurations from backend");
      }
      const configs = await configsRes.json();
      setMonitoringConfigs(configs);
    } catch (err) {
      setMonitoringError(err instanceof Error ? err.message : "Error fetching monitoring configurations");
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  // Fetch System Settings Configuration
  const fetchSysSettings = useCallback(async () => {
    setSysSettingsLoading(true);
    setSysSettingsError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      if (!res.ok) {
        throw new Error("Failed to load global system settings from backend");
      }
      const data = await res.json();
      setSysSettings(data);
    } catch (err) {
      setSysSettingsError(err instanceof Error ? err.message : "Error fetching global settings");
    } finally {
      setSysSettingsLoading(false);
    }
  }, []);

  // Save System Settings Configuration
  const handleSaveSysSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSysSettingsLoading(true);
    setSysSettingsError(null);
    setSysSettingsSaveSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sysSettings),
      });
      if (!res.ok) {
        throw new Error("Failed to update global system settings on backend");
      }
      const data = await res.json();
      setSysSettings(data);
      setSysSettingsSaveSuccess("Settings updated successfully!");
      setTimeout(() => setSysSettingsSaveSuccess(null), 3000);
    } catch (err) {
      setSysSettingsError(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setSysSettingsLoading(false);
    }
  };

  // Toggle user monitoring configuration
  const handleToggleMonitoring = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/monitoring/${username}/toggle`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to toggle monitoring configurations for @${username}`);
      }
      fetchMonitoringData();
    } catch (err) {
      console.error("Toggle monitoring failed:", err);
    }
  };

  const fetchInboxLeads = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const queryParams = new URLSearchParams();
      if (inboxUrgency) queryParams.append("urgency", inboxUrgency);
      if (inboxCategory) queryParams.append("category", inboxCategory);
      if (inboxMinIntent.trim()) queryParams.append("buyingIntent", inboxMinIntent.trim());
      if (inboxService.trim()) queryParams.append("service", inboxService.trim());

      const res = await fetch(`${API_BASE_URL}/leads/inbox?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch inbox leads: ${res.statusText}`);
      }
      const data = await res.json();
      setQualifiedLeads(data);
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : "Error fetching inbox leads");
    } finally {
      setInboxLoading(false);
    }
  }, [inboxUrgency, inboxCategory, inboxMinIntent, inboxService]);

  const fetchInboxLeadDetails = useCallback(async (username: string) => {
    setSelectedInboxLeadUsername(username);
    setSelectedInboxLeadLoading(true);
    setSelectedInboxLeadError(null);
    setSelectedInboxLeadDetails(null);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/inbox/${username}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch details for lead @${username}`);
      }
      const data = await res.json();
      setSelectedInboxLeadDetails(data);
    } catch (err) {
      setSelectedInboxLeadError(err instanceof Error ? err.message : `Error fetching details for lead @${username}`);
    } finally {
      setSelectedInboxLeadLoading(false);
    }
  }, []);

  const handleExportInbox = (format: "csv" | "json") => {
    window.open(`${API_BASE_URL}/leads/export?format=${format}`, "_blank");
  };



  const fetchCrmData = useCallback(async () => {
    setCrmLoading(true);
    setCrmError(null);
    try {
      const queryParams = new URLSearchParams();
      if (crmFilterStatus) queryParams.append("status", crmFilterStatus);
      if (crmFilterPriority) queryParams.append("priority", crmFilterPriority);
      if (crmFilterAssignedTo.trim()) queryParams.append("assignedTo", crmFilterAssignedTo.trim());

      const [leadsRes, statsRes, activityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/crm/leads?${queryParams.toString()}`),
        fetch(`${API_BASE_URL}/crm/stats`),
        fetch(`${API_BASE_URL}/crm/activity`)
      ]);

      if (!leadsRes.ok || !statsRes.ok || !activityRes.ok) {
        throw new Error("Failed to fetch CRM dataset from backend");
      }

      const [leadsData, statsData, activityData] = await Promise.all([
        leadsRes.json(),
        statsRes.json(),
        activityRes.json()
      ]);

      setCrmLeads(leadsData);
      setCrmStats(statsData);
      setCrmActivity(activityData);
    } catch (err) {
      setCrmError(err instanceof Error ? err.message : "Error fetching CRM data");
    } finally {
      setCrmLoading(false);
    }
  }, [crmFilterStatus, crmFilterPriority, crmFilterAssignedTo]);

  const fetchCrmLeadDetails = useCallback(async (username: string) => {
    setSelectedCrmUsername(username);
    setSelectedCrmLoading(true);
    setSelectedCrmError(null);
    setSelectedCrmDetails(null);
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch CRM details for @${username}`);
      }
      const data = await res.json();
      setSelectedCrmDetails(data);
    } catch (err) {
      setSelectedCrmError(err instanceof Error ? err.message : `Error fetching details for @${username}`);
    } finally {
      setSelectedCrmLoading(false);
    }
  }, []);

  const handleUpdateCrmStatus = async (username: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");

      fetchCrmData();
      if (selectedCrmUsername && selectedCrmUsername.toLowerCase() === username.toLowerCase()) {
        fetchCrmLeadDetails(username);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating status");
    }
  };

  const handleAssignCrmLead = async (username: string, assignedTo: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo })
      });
      if (!res.ok) throw new Error("Failed to assign lead");

      fetchCrmData();
      if (selectedCrmUsername && selectedCrmUsername.toLowerCase() === username.toLowerCase()) {
        fetchCrmLeadDetails(username);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error assigning lead");
    }
  };

  const handleAddCrmNote = async (e: React.FormEvent, username: string) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() })
      });
      if (!res.ok) throw new Error("Failed to add note");

      setNoteContent("");
      fetchCrmData();
      if (selectedCrmUsername && selectedCrmUsername.toLowerCase() === username.toLowerCase()) {
        fetchCrmLeadDetails(username);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding note");
    }
  };

  const handleAddCrmTag = async (e: React.FormEvent, username: string) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/crm/leads/${username}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tagInput.trim() })
      });
      if (!res.ok) throw new Error("Failed to add tag");

      setTagInput("");
      fetchCrmData();
      if (selectedCrmUsername && selectedCrmUsername.toLowerCase() === username.toLowerCase()) {
        fetchCrmLeadDetails(username);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding tag");
    }
  };

  useEffect(() => {
    if (activeTab === "qualified") {
      fetchInboxLeads();
      fetchCrmData();
    }
  }, [activeTab, fetchInboxLeads, fetchCrmData]);

  useEffect(() => {
    if (activeTab === "crm") {
      fetchCrmData();
    }
  }, [activeTab, fetchCrmData]);

  useEffect(() => {
    if (activeTab === "settings") {
      fetchMonitoringData();
      fetchSysSettings();
    }
  }, [activeTab, fetchMonitoringData, fetchSysSettings]);

  useEffect(() => {
    fetchSysSettings();
  }, [fetchSysSettings]);

  useEffect(() => {
    // if (activeTab !== "hashtag-discovery") return;
    if (activeTab !== "seed-influencers") return;

    fetchInfluencers();
    fetchAllJobs();
    fetchQueueStats();
    const intervalStatsId = setInterval(fetchQueueStats, 2000);
    const intervalJobsId = setInterval(fetchAllJobs, 3000);
    const intervalInfluencersId = setInterval(fetchInfluencers, 5000);

    return () => {
      clearInterval(intervalStatsId);
      clearInterval(intervalJobsId);
      clearInterval(intervalInfluencersId);
    };
  }, [activeTab, fetchAllJobs, fetchQueueStats, fetchInfluencers]);

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
          // if (activeDiscoveryKeyword) {
          //   fetchDiscoveredUsers(activeDiscoveryKeyword);
          // }
          // Clear the job card after 5s so the dashboard doesn't stay frozen on last state
          setTimeout(() => setJob(null), 5000);
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
  }, [activeJobId]);

  // Poll worker logs
  useEffect(() => {
    if (activeTab !== "logs") return;

    fetchWorkerLogs(selectedWorker);

    if (!logsAutoRefresh) return;
    const intervalId = setInterval(() => {
      fetchWorkerLogs(selectedWorker);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [activeTab, selectedWorker, logsAutoRefresh, fetchWorkerLogs]);

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

  // Group leads by buying intent score (not just recommendedAction string)
  // High: buyingIntent > 60, Medium: > 30, Low: rest
  const highPriorityLeads = qualifiedLeads.filter(lead => (lead.buyingIntent ?? 0) > 60);
  const mediumPriorityLeads = qualifiedLeads.filter(lead => (lead.buyingIntent ?? 0) > 30 && (lead.buyingIntent ?? 0) <= 60);
  const lowPriorityLeads = qualifiedLeads.filter(lead => (lead.buyingIntent ?? 0) <= 30);

  const renderLeadCard = (lead: any) => {
    const getUrgencyColor = (urgency: string) => {
      if (urgency === "high") return "#ff4566";
      if (urgency === "medium") return "#ffb600";
      return "#00baff";
    };

    return (
      <div
        key={lead._id}
        className="glass-card"
        style={{
          padding: "1rem",
          background: "rgba(255, 255, 255, 0.02)",
          border: "var(--glass-border)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "default"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ fontWeight: "bold", color: "#fff", fontSize: "1rem" }}>@{lead.username}</span>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: "bold",
            color: getUrgencyColor(lead.urgency),
            background: `${getUrgencyColor(lead.urgency)}15`,
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
            textTransform: "uppercase"
          }}>
            {lead.urgency}
          </span>
        </div>

        <p style={{ margin: "0.25rem 0", color: "#eee", fontSize: "0.9rem" }}>
          <strong>Problem:</strong> {lead.problem}
        </p>
        <p style={{ margin: "0.25rem 0", color: "#eee", fontSize: "0.9rem" }}>
          <strong>Service:</strong> {lead.serviceNeeded}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", color: "var(--color-text-dim)" }}>
            <span>🎯 Intent: <strong>{lead.buyingIntent}%</strong></span>
            <span>🔥 Score: <strong>{lead.leadScore}</strong></span>
          </div>
          <button
            onClick={() => fetchInboxLeadDetails(lead.username)}
            className="btn btn-secondary"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
          >
            Open Details
          </button>
        </div>
      </div>
    );
  };

  const renderCrmLeadCard = (lead: LeadPipelineResult) => {
    const getPriorityColor = (prio: string) => {
      if (prio === "high") return "#ff4566";
      if (prio === "medium") return "#ffb600";
      return "#00baff";
    };

    return (
      <div
        key={lead._id}
        className="glass-card"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", lead.username);
        }}
        style={{
          padding: "1rem",
          background: "rgba(255, 255, 255, 0.02)",
          border: "var(--glass-border)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "grab",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>@{lead.username}</span>
          <span style={{
            fontSize: "0.7rem",
            fontWeight: "bold",
            color: getPriorityColor(lead.priority),
            background: `${getPriorityColor(lead.priority)}15`,
            padding: "0.15rem 0.35rem",
            borderRadius: "4px",
            textTransform: "uppercase"
          }}>
            {lead.priority}
          </span>
        </div>

        <p style={{ margin: "0.2rem 0", color: "#ddd", fontSize: "0.85rem" }}>
          <strong>Need:</strong> {lead.serviceNeeded}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", color: "var(--color-text-dim)" }}>
            <span>🎯 Intent: <strong>{lead.buyingIntent}%</strong></span>
            <span>🔥 Score: <strong>{lead.leadScore}</strong></span>
          </div>
          <button
            onClick={() => fetchCrmLeadDetails(lead.username)}
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
          >
            Manage
          </button>
        </div>
      </div>
    );
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

      {/* Core Pipeline Status & Telemetry */}
      <div className="pipeline-telemetry animate-fade-in" style={{ marginBottom: "2rem" }}>
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "0.5rem", color: "#ffffff" }}>
              ⚡ Core Pipeline Telemetry & Flow
            </h3>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-dim)" }}>
              Processing Queue State: <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{(queueStats?.active || 0)} Active</span> / <span style={{ color: "var(--color-warning)", fontWeight: "bold" }}>{(queueStats?.waiting || 0)} Waiting</span>
            </div>
          </div>
          <div className="pipeline-flow-wrapper">
            <div className={`pipeline-step-node ${queueStats?.breakdown?.discovery?.active > 0 || queueStats?.breakdown?.influencerDiscovery?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">🔍</div>
              <div className="step-label">Discovery</div>
              <div className="step-status">
                {queueStats?.breakdown?.discovery?.active > 0 || queueStats?.breakdown?.influencerDiscovery?.active > 0 ? "⚡ Running" : "Idle"}
              </div>
              {(queueStats?.breakdown?.discovery?.active > 0 || queueStats?.breakdown?.influencerDiscovery?.active > 0) && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className={`pipeline-step-node ${queueStats?.breakdown?.commentScrape?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">💬</div>
              <div className="step-label">Comment Scrape</div>
              <div className="step-status">
                {queueStats?.breakdown?.commentScrape?.active > 0 ? "⚡ Scraping" : "Idle"}
              </div>
              {queueStats?.breakdown?.commentScrape?.active > 0 && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className={`pipeline-step-node ${queueStats?.breakdown?.commentAnalysis?.active > 0 || queueStats?.breakdown?.postAnalysis?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">🔮</div>
              <div className="step-label">AI Intent Gate</div>
              <div className="step-status">
                {queueStats?.breakdown?.commentAnalysis?.active > 0 || queueStats?.breakdown?.postAnalysis?.active > 0 ? "⚡ Processing" : "Idle"}
              </div>
              {(queueStats?.breakdown?.commentAnalysis?.active > 0 || queueStats?.breakdown?.postAnalysis?.active > 0) && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className={`pipeline-step-node ${queueStats?.breakdown?.profileScrape?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">🕵️</div>
              <div className="step-label">Profile Scraper</div>
              <div className="step-status">
                {queueStats?.breakdown?.profileScrape?.active > 0 ? "⚡ Crawling" : "Idle"}
              </div>
              {queueStats?.breakdown?.profileScrape?.active > 0 && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className={`pipeline-step-node ${queueStats?.breakdown?.intelligence?.active > 0 || queueStats?.breakdown?.embedding?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">📈</div>
              <div className="step-label">Overlap Booster</div>
              <div className="step-status">
                {queueStats?.breakdown?.intelligence?.active > 0 || queueStats?.breakdown?.embedding?.active > 0 ? "⚡ Scoring" : "Idle"}
              </div>
              {(queueStats?.breakdown?.intelligence?.active > 0 || queueStats?.breakdown?.embedding?.active > 0) && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className={`pipeline-step-node ${queueStats?.breakdown?.qualification?.active > 0 ? "active" : ""}`}>
              <div className="step-icon">⚖️</div>
              <div className="step-label">Lead Qualifier</div>
              <div className="step-status">
                {queueStats?.breakdown?.qualification?.active > 0 ? "⚡ Qualifying" : "Idle"}
              </div>
              {queueStats?.breakdown?.qualification?.active > 0 && <div className="pulse-indicator" />}
            </div>
            
            <div className="pipeline-connector" />
            
            <div className="pipeline-step-node active">
              <div className="step-icon">📂</div>
              <div className="step-label">CRM Integration</div>
              <div className="step-status" style={{ color: "var(--color-success)" }}>Connected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation animate-fade-in" style={{ marginBottom: "2rem" }}>
        <button
          className={`tab-btn ${activeTab === "discovery" ? "active" : ""}`}
          onClick={() => setActiveTab("discovery")}
        >
          🔍 Semantic Search
        </button>
        {/* <button
          className={`tab-btn ${activeTab === "hashtag-discovery" ? "active" : ""}`}
          onClick={() => setActiveTab("hashtag-discovery")}
        >
          🏷️ Hashtag Discovery
        </button> */}
        <button
          className={`tab-btn ${activeTab === "seed-influencers" ? "active" : ""}`}
          onClick={() => setActiveTab("seed-influencers")}
        >
          🎯 Seed Influencers
        </button>
        <button
          className={`tab-btn ${activeTab === "qualified" ? "active" : ""}`}
          onClick={() => setActiveTab("qualified")}
        >
          📥 Qualified Leads
        </button>
        <button
          className={`tab-btn ${activeTab === "crm" ? "active" : ""}`}
          onClick={() => setActiveTab("crm")}
        >
          📂 CRM Pipeline
        </button>
        <button
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Settings
        </button>
        <button
          className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          📋 System Logs
        </button>
        {isDevMode && (
          <button
            className={`tab-btn ${activeTab === "developer" ? "active" : ""}`}
            onClick={() => setActiveTab("developer")}
            style={{ border: "1px dashed var(--color-accent)", color: "var(--color-accent)" }}
          >
            🛠️ Dev Panel
          </button>
        )}
      </div>

      {activeTab === "discovery" && (
        <div className="discovery-container animate-fade-in" style={{ padding: "0 1rem" }}>
          {/* Page Help / Description Panel */}
          <div className="glass-card page-description-banner" style={{ marginBottom: "1.5rem" }}>
            <h3>🔍 Semantic Lead Discovery</h3>
            <p>
              Search across the scraped universe using natural language semantic queries, or input hashtags to initiate automated discovery pipelines.
            </p>
          </div>

          {/* Top Search bar card */}
          <div className="glass-card" style={{ padding: "2rem", marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "1rem" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Describe your ideal lead (e.g. 'people looking for dermatologists' or 'skincare routine advice')..."
                className="input-field"
                style={{
                  flex: 1,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "var(--glass-border)",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "1rem",
                  fontSize: "1rem",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "0 2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                disabled={searchLoading}
              >
                {searchLoading ? <div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></div> : "Search"}
              </button>
            </form>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-dim)", fontWeight: "bold" }}>Try queries:</span>
              <button
                onClick={() => {
                  setSearchQuery("Show me people who need help with dry skin");
                  fetchSearchResults("Show me people who need help with dry skin");
                }}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderRadius: "9999px", minWidth: "auto", margin: 0 }}
              >
                ✨ Help with dry skin
              </button>
              <button
                onClick={() => {
                  setSearchQuery("Find fitness advice seekers");
                  fetchSearchResults("Find fitness advice seekers");
                }}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderRadius: "9999px", minWidth: "auto", margin: 0 }}
              >
                ✨ Fitness advice
              </button>
              <button
                onClick={() => {
                  setSearchQuery("Need software development");
                  fetchSearchResults("Need software development");
                }}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderRadius: "9999px", minWidth: "auto", margin: 0 }}
              >
                ✨ Software development
              </button>
              <button
                onClick={() => {
                  setSearchQuery("Looking for a chiropractor");
                  fetchSearchResults("Looking for a chiropractor");
                }}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderRadius: "9999px", minWidth: "auto", margin: 0 }}
              >
                ✨ Chiropractor search
              </button>
            </div>
          </div>

          <div className="glass-card card-table animate-fade-in" style={{ minHeight: "300px" }}>
            <h2 className="card-title">Results Matching query: {searchQuery || "All"}</h2>
            {searchLoading && (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                <p style={{ color: "var(--color-text-dim)" }}>Matching vector embeddings...</p>
              </div>
            )}
            {searchError && <div className="toast toast-error">{searchError}</div>}
            {!searchLoading && !searchError && searchResults.length === 0 && (
              <div className="empty-state" style={{ padding: "4rem 0" }}>
                <div className="empty-state-icon">📭</div>
                <h3>No Results Found</h3>
                <p>Submit a query in the search bar above to query vector space.</p>
              </div>
            )}
            {!searchLoading && !searchError && searchResults.length > 0 && (
              <div className="table-responsive">
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Problem Area</th>
                      <th>Service Needed</th>
                      <th>Rec. Action</th>
                      <th>Buying Intent</th>
                      <th>Similarity Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((result, idx) => {
                      const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === result.username.toLowerCase());
                      return (
                        <tr key={idx} className="lead-row">
                          <td>
                            <a href={`https://instagram.com/${result.username}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "bold" }}>
                              @{result.username}
                            </a>
                          </td>
                          <td>{result.problem}</td>
                          <td>{result.serviceNeeded}</td>
                          <td>
                            <span style={{
                              color: result.recommendedAction === "Contact immediately" ? "#ff4566" : "var(--color-accent)",
                              fontWeight: "bold"
                            }}>
                              {result.recommendedAction}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: "bold" }}>{result.buyingIntent}%</span>
                          </td>
                          <td>
                            {(result.similarityScore * 100).toFixed(1)}%
                          </td>
                          <td>
                            {inCrm ? (
                              <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.85rem" }}>✅ In CRM</span>
                            ) : (
                              <button
                                onClick={() => handleAddToCrm(result.username)}
                                className="btn btn-primary"
                                style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
                              >
                                Add to CRM
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/*
      activeTab === "hashtag-discovery" && (
        <div className="discovery-container animate-fade-in" style={{ padding: "0 1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem", alignItems: "start" }}>
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0 }}>🏷️ Trigger Hashtag Scraper Pipeline</h3>
              <form onSubmit={handleHashtagDiscoverySubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Hashtag Target (use comma or # to separate multiple)</label>
                  <input
                    type="text"
                    placeholder="e.g. skincare, crossfit, #wellness"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    className="input-field"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "var(--glass-border)",
                      borderRadius: "8px",
                      color: "#fff",
                      padding: "0.75rem",
                      outline: "none"
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingHashtag || !!activeJobId}
                >
                  {submittingHashtag ? "Triggering..." : "Launch Keyword Scraper"}
                </button>
              </form>
              {hashtagError && <div className="toast toast-error">{hashtagError}</div>}

              {(activeJobId || job || jobError) && (
                <div className="glass-card" style={{ padding: "1rem", marginTop: "1rem", background: "rgba(0,0,0,0.2)" }}>
                  <h4 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.5rem" }}>⚙️ Active Scrape Job</h4>
                  {jobError && <div style={{ color: "var(--color-error)", fontSize: "0.8rem" }}>Error: {jobError}</div>}
                  {activeJobId && !job && <p style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>Starting job queue...</p>}
                  {job && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.8rem" }}>
                      <div>Status: <span style={{ color: "var(--color-accent)" }}>{job.state.toUpperCase()}</span></div>
                      {job.processedOn && (
                        <div style={{ color: "var(--color-text-dim)" }}>
                          {job.state === "active"
                            ? `Elapsed: ${Math.floor((Date.now() - job.processedOn) / 1000)}s`
                            : `Finished in: ${Math.floor(((job as any).finishedOn ?? Date.now()) - job.processedOn) / 1000}s`
                          }
                        </div>
                      )}
                      {typeof job.progress === "object" && job.progress !== null ? (
                        <>
                          <div>
                            Progress: {job.progress.percent}%
                            {job.progress.stage && (
                              <span style={{ color: "var(--color-accent)", marginLeft: "0.5rem", fontWeight: "bold" }}>
                                ({job.progress.stage})
                              </span>
                            )}
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${job.progress.percent}%`, height: "100%", background: "var(--color-primary)", transition: "width 0.3s ease" }}></div>
                          </div>
                          {job.progress.currentKeyword && (
                            <div style={{ color: "var(--color-text-dim)", marginTop: "0.25rem" }}>
                              🏷️ Keyword: <strong style={{ color: "#fff" }}>#{job.progress.currentKeyword}</strong>
                            </div>
                          )}
                          {job.progress.currentUsername && (
                            <div style={{ color: "var(--color-accent)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "1.5px" }}></div>
                              <span>Processing: <strong>@{job.progress.currentUsername}</strong> ({job.progress.currentIndex}/{job.progress.totalCount})</span>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                            <span style={{ color: "#4ade80", fontWeight: "500" }}>✓ Added: {job.progress.added}</span>
                            <span style={{ color: "var(--color-text-dim)" }}>⤳ Skipped: {job.progress.skipped}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>Progress: {job.progress}%</div>
                          <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${job.progress}%`, height: "100%", background: "var(--color-primary)", transition: "width 0.3s ease" }}></div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass-card card-table">
              <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0, marginBottom: "1rem" }}>Discovered Accounts via #{activeDiscoveryKeyword || "None"}</h3>
              {discoveredUsers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-dim)" }}>
                  No users discovered from the active session yet. Run the scraper to pull accounts.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Core Problem</th>
                        <th>Service Needed</th>
                        <th>Intent Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveredUsers.map((u, idx) => {
                        const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === u.username.toLowerCase());
                        return (
                          <tr key={idx} className="lead-row">
                            <td style={{ fontWeight: "bold" }}>@{u.username}</td>
                            <td>{u.problem}</td>
                            <td>{u.serviceNeeded}</td>
                            <td>{u.buyingIntent}%</td>
                            <td>
                              {inCrm ? (
                                <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.85rem" }}>✅ In CRM</span>
                              ) : (
                                <button
                                  onClick={() => handleAddToCrm(u.username)}
                                  className="btn btn-primary"
                                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
                                >
                                  Add to CRM
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
            // Summary counters grid
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem"
            }}>
              <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #ffb600" }}>
                <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Waiting</div>
                <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#ffb600" }}>
                  {queueStats ? queueStats.waiting : 0}
                </div>
              </div>
              <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #00baff" }}>
                <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Working (Active)</div>
                <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#00baff" }}>
                  {queueStats ? queueStats.active : 0}
                </div>
              </div>
              <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #22c55e" }}>
                <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Completed</div>
                <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#22c55e" }}>
                  {queueStats ? queueStats.completed : 0}
                </div>
              </div>
              <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #ff4566" }}>
                <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Failed</div>
                <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#ff4566" }}>
                  {queueStats ? queueStats.failed : 0}
                </div>
              </div>

            </div>

            {jobsLoading && allJobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                <p style={{ color: "var(--color-text-dim)" }}>Loading jobs pipeline...</p>
              </div>
            ) : jobsError ? (
              <div className="toast toast-error">{jobsError}</div>
            ) : allJobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-dim)" }}>
                No discovery or scrape jobs have been triggered in this deployment session.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: "450px", overflowY: "auto" }}>
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Type / Queue</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Reason</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allJobs.map((j) => {
                      const getStatusBadge = (state: string) => {
                        const s = state.toLowerCase();
                        if (s === "completed") return <span className="status-badge status-completed">Completed</span>;
                        if (s === "active") return <span className="status-badge status-active" style={{ background: "#00baff20", color: "#00baff", borderColor: "#00baff" }}>Working</span>;
                        if (s === "waiting") return <span className="status-badge status-delayed" style={{ background: "#ffb60020", color: "#ffb600", borderColor: "#ffb600" }}>Waiting</span>;
                        if (s === "delayed") return <span className="status-badge status-delayed">Delayed</span>;
                        if (s === "failed") return <span className="status-badge status-failed">Failed</span>;
                        return <span className="status-badge">{state.toUpperCase()}</span>;
                      };

                      const getTargetValue = () => {
                        if (j.queue === "discovery") return `#${j.data?.hashtag || "unknown"}`;
                        return `@${j.data?.username || "unknown"}`;
                      };

                      const formatProgress = () => {
                        if (j.state === "completed") return "100%";
                        if (j.state === "failed") return "Failed";
                        if (typeof j.progress === "object" && j.progress !== null) {
                          return `${j.progress.percent || 0}%`;
                        }
                        if (typeof j.progress === "number") {
                          return `${j.progress}%`;
                        }
                        return "0%";
                      };

                      return (
                        <tr key={j.id} className="lead-row">
                          <td style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>{j.id}</td>
                          <td style={{ textTransform: "capitalize", fontWeight: "bold" }}>{j.queue}</td>
                          <td>
                            <strong style={{ color: "#fff" }}>{getTargetValue()}</strong>
                            {j.state === "active" && j.processedOn && (
                              <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginTop: "0.15rem" }}>
                                Elapsed: {Math.floor((Date.now() - j.processedOn) / 1000)}s
                              </div>
                            )}
                          </td>
                          <td>{getStatusBadge(j.state)}</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "0.8rem", width: "35px" }}>{formatProgress()}</span>
                                {j.state === "active" && (
                                  <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden", minWidth: "60px" }}>
                                    <div style={{
                                      width: formatProgress(),
                                      height: "100%",
                                      background: "var(--color-primary)",
                                      transition: "width 0.3s ease"
                                    }}></div>
                                  </div>
                                )}
                              </div>
                              {j.state === "active" && typeof j.progress === "object" && j.progress !== null && j.progress.stage && (
                                <span style={{ fontSize: "0.75rem", color: "var(--color-accent)", fontWeight: "500" }}>{j.progress.stage}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {(() => {
                              if (j.state === "failed") {
                                return <span style={{ color: "#ff4566", fontSize: "0.8rem", fontWeight: "500" }}>Scrape Error</span>;
                              }
                              const rv = j.returnvalue;
                              const rvStatus = rv?.status?.toUpperCase();
                              if (j.state === "completed" && rv && rvStatus === "SKIPPED") {
                                const r = (rv.reason || "").toUpperCase();
                                if (r === "TIMEOUT") return <span style={{ color: "#ffb600", fontSize: "0.8rem", fontWeight: "500" }}>⏱ Timeout</span>;
                                if (r === "SKIPPED_LARGE_ACCOUNT") return <span style={{ color: "#ff4566", fontSize: "0.8rem", fontWeight: "500" }}>Large Account</span>;
                                if (r === "PRIVATE_ACCOUNT" || r === "PRIVATE ACCOUNT") return <span style={{ color: "#ffb600", fontSize: "0.8rem", fontWeight: "500" }}>Private Account</span>;
                                if (r === "NO_POSTS_FOUND" || r === "NO_POST_URLS_FOUND") return <span style={{ color: "#ffb600", fontSize: "0.8rem", fontWeight: "500" }}>No Post URLs Found</span>;
                                return <span style={{ color: "var(--color-text-dim)", fontSize: "0.8rem" }}>{rv.reason || "Skipped"}</span>;
                              }
                              return <span style={{ color: "var(--color-text-dim)", fontSize: "0.8rem" }}>—</span>;
                            })()}
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                            {new Date(j.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      {activeTab === "seed-influencers" && (() => {
        const activeInfluencers = influencers.filter(inf => !inf.isProcessed);
        const processedInfluencers = influencers.filter(inf => inf.isProcessed);
        return (
          <div className="discovery-container animate-fade-in" style={{ padding: "0 1rem" }}>
            {/* Page Help / Description Panel */}
            <div className="glass-card page-description-banner" style={{ marginBottom: "1.5rem" }}>
              <h3>🎯 Seed Influencer Registry</h3>
              <p>
                Manage seed influencer accounts within your target niche. The system monitors their posts and comment feeds to identify potential buyers asking questions or seeking recommendations.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem", alignItems: "start" }}>
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0 }}>🎯 Manage Seed Influencers</h3>
                <form onSubmit={handleAddInfluencer} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Instagram Username</label>
                    <input
                      type="text"
                      placeholder="e.g. janesmith_fitness"
                      value={newInfluencerUsername}
                      onChange={(e) => setNewInfluencerUsername(e.target.value)}
                      className="input-field"
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "var(--glass-border)",
                        borderRadius: "8px",
                        color: "#fff",
                        padding: "0.75rem",
                        outline: "none"
                      }}
                    />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Target Niche</label>
                    <input
                      type="text"
                      placeholder="e.g. fitness, real_estate"
                      value={newInfluencerNiche}
                      onChange={(e) => setNewInfluencerNiche(e.target.value)}
                      className="input-field"
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "var(--glass-border)",
                        borderRadius: "8px",
                        color: "#fff",
                        padding: "0.75rem",
                        outline: "none"
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Add Seed Influencer
                  </button>
                </form>
                {influencerError && <div className="toast toast-error">{influencerError}</div>}

                <div className="glass-card" style={{ padding: "1rem", marginTop: "1rem", background: "rgba(0,0,0,0.2)" }}>
                  <h4 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.5rem" }}>⚙️ Control Center</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", marginBottom: "1rem" }}>
                    Trigger a manual scan of all active seed influencers. This checks their 5 most recent posts for new comments to scrape and analyze.
                  </p>
                  <button
                    onClick={handleTriggerInfluencerScan}
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    🚀 Run Discovery Scan Now
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Table 1: Active Monitoring Targets */}
                <div className="glass-card card-table">
                  <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0, marginBottom: "1rem" }}>🎯 Active Monitoring Targets ({activeInfluencers.length})</h3>
                  {activeInfluencers.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-dim)" }}>
                      No active seed influencers in queue. Add targets or re-activate processed seeds.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="leads-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Niche</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeInfluencers.map((inf, idx) => (
                            <tr key={idx} className="lead-row">
                              <td style={{ fontWeight: "bold" }}>@{inf.username}</td>
                              <td>
                                <span style={{
                                  background: "rgba(0, 186, 255, 0.1)",
                                  color: "#00baff",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "bold"
                                }}>
                                  {inf.niche}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${inf.isActive ? "status-active" : "status-failed"}`} style={{
                                  background: inf.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                  color: inf.isActive ? "#22c55e" : "#ef4444",
                                  borderColor: inf.isActive ? "#22c55e" : "#ef4444"
                                }}>
                                  {inf.isActive ? "Active" : "Paused"}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => handleRunInfluencer(inf.username)}
                                    className="btn btn-primary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
                                    disabled={!inf.isActive}
                                    title={inf.isActive ? "Start discovery scan" : "Activate first to scan"}
                                  >
                                    ⚡ Run Scan
                                  </button>
                                  <button
                                    onClick={() => handleToggleInfluencer(inf.username)}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
                                  >
                                    {inf.isActive ? "Pause" : "Activate"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInfluencer(inf.username)}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0, color: "#ff4566", borderColor: "rgba(255,69,102,0.3)" }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Table 2: Processed Seeds Summary */}
                <div className="glass-card card-table">
                  <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0, marginBottom: "1rem" }}>✅ Processed Seeds Summary ({processedInfluencers.length})</h3>
                  {processedInfluencers.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-dim)" }}>
                      No completed scans yet. Run scans on active targets to view summaries.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="leads-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Niche</th>
                            <th>Processed Date</th>
                            <th>Scrape Stats</th>
                            <th>Leads Count</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedInfluencers.map((inf, idx) => (
                            <tr key={idx} className="lead-row">
                              <td style={{ fontWeight: "bold" }}>@{inf.username}</td>
                              <td>
                                <span style={{
                                  background: "rgba(34, 197, 94, 0.1)",
                                  color: "#22c55e",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "bold"
                                }}>
                                  {inf.niche}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                                {inf.processedAt ? new Date(inf.processedAt).toLocaleString() : "Recently"}
                              </td>
                              <td style={{ fontSize: "0.8rem" }}>
                                <div style={{ display: "flex", gap: "0.5rem", color: "var(--color-text-dim)" }}>
                                  <span>posts: <strong style={{ color: "#fff" }}>{inf.postsCount || 0}</strong></span>
                                  <span>comments: <strong style={{ color: "#fff" }}>{inf.commentsCount || 0}</strong></span>
                                </div>
                              </td>
                              <td>
                                <button
                                  onClick={() => fetchInfluencerLeads(inf.username)}
                                  style={{
                                    background: inf.leadsCount > 0 ? "rgba(167, 139, 250, 0.15)" : "rgba(255, 255, 255, 0.03)",
                                    border: inf.leadsCount > 0 ? "1px solid #a78bfa" : "var(--glass-border)",
                                    color: inf.leadsCount > 0 ? "#c084fc" : "var(--color-text-dim)",
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "6px",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  💡 {inf.leadsCount || 0} Leads
                                </button>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => handleRunInfluencer(inf.username)}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0, color: "var(--color-accent)", borderColor: "rgba(0, 186, 255, 0.3)" }}
                                  >
                                    🔄 Run Again
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInfluencer(inf.username)}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0, color: "#ff4566", borderColor: "rgba(255,69,102,0.3)" }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

          {/* Detailed Leads Panel for Selected Influencer */}
          {selectedInfluencerForLeads && (
            <div className="glass-card animate-fade-in" style={{ marginTop: "2rem", padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0, color: "#fff" }}>
                    📥 Qualified Leads from @{selectedInfluencerForLeads}
                  </h3>
                  <p style={{ margin: "0.25rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                    Commenters who showed buying intent on posts of this influencer.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInfluencerForLeads(null)}
                  className="btn btn-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", minWidth: "auto", margin: 0 }}
                >
                  Close Panel
                </button>
              </div>

              {influencerLeadsLoading && (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                  <p style={{ color: "var(--color-text-dim)" }}>Loading leads...</p>
                </div>
              )}

              {influencerLeadsError && (
                <div className="toast toast-error">{influencerLeadsError}</div>
              )}

              {!influencerLeadsLoading && !influencerLeadsError && influencerLeadsList.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-dim)" }}>
                  No qualified leads found for this influencer yet. Make sure to run discovery scan.
                </div>
              )}

              {!influencerLeadsLoading && !influencerLeadsError && influencerLeadsList.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
                  {influencerLeadsList.map((lead, idx) => {
                    const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === lead.username.toLowerCase());
                    return (
                      <div key={idx} className="glass-card" style={{ padding: "1.25rem", background: "rgba(255, 255, 255, 0.02)", border: "var(--glass-border)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", color: "#a78bfa", fontSize: "1rem" }}>@{lead.username}</span>
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            color: lead.qualification?.urgency === "high" ? "#ff4566" : lead.qualification?.urgency === "medium" ? "#ffd166" : "#00baff",
                            background: lead.qualification?.urgency === "high" ? "rgba(255,69,102,0.15)" : lead.qualification?.urgency === "medium" ? "rgba(255,209,102,0.15)" : "rgba(0,186,255,0.15)",
                            padding: "0.15rem 0.35rem",
                            borderRadius: "4px"
                          }}>
                            {lead.qualification?.urgency?.toUpperCase() || "LOW"} URGENCY
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee", fontStyle: "italic", background: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "4px" }}>
                          &ldquo;{lead.commentText}&rdquo;
                        </p>
                        {lead.qualification ? (
                          <>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}>
                              <strong>Problem:</strong> {lead.qualification.problem}
                            </p>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}>
                              <strong>Service:</strong> {lead.qualification.serviceNeeded}
                            </p>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
                              <strong>Reason:</strong> {lead.qualification.qualificationReason}
                            </p>
                          </>
                        ) : (
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-dim)", fontStyle: "italic" }}>
                            Lead profile/following list scrape in queue...
                          </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                            🎯 Intent: {lead.intentScore}%
                          </span>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            {lead.qualification && (
                              <button
                                onClick={() => {
                                  setActiveTab("qualified");
                                  fetchInboxLeadDetails(lead.username);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                              >
                                View Details
                              </button>
                            )}
                            {inCrm ? (
                              <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.75rem", alignSelf: "center" }}>✅ In CRM</span>
                            ) : (
                              <button
                                onClick={() => handleAddToCrm(lead.username)}
                                className="btn btn-primary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                              >
                                Add to CRM
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "qualified" && (
        <div className="inbox-container animate-fade-in" style={{ padding: "0 1rem" }}>
          {/* Header/Controls bar */}
          <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "#fff" }}>📥 Qualified Lead Inbox</h2>
                <p style={{ margin: "0.25rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.9rem" }}>
                  Analyze qualified buying intentions and orchestrate outreach campaigns.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => handleExportInbox("csv")}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={() => handleExportInbox("json")}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  🌐 Export JSON
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Urgency Level</label>
                <select
                  value={inboxUrgency}
                  onChange={(e) => setInboxUrgency(e.target.value)}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "var(--glass-border)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "0.6rem",
                    width: "100%",
                    outline: "none"
                  }}
                >
                  <option value="" style={{ background: "#1b0b30" }}>All Urgencies</option>
                  <option value="high" style={{ background: "#1b0b30" }}>🔴 High Urgency</option>
                  <option value="medium" style={{ background: "#1b0b30" }}>🟡 Medium Urgency</option>
                  <option value="low" style={{ background: "#1b0b30" }}>🔵 Low Urgency</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Service Needed</label>
                <input
                  type="text"
                  placeholder="e.g. Dermatologist, Recruiter"
                  value={inboxService}
                  onChange={(e) => setInboxService(e.target.value)}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "var(--glass-border)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "0.6rem",
                    width: "100%",
                    outline: "none"
                  }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Category Filter</label>
                <select
                  value={inboxCategory}
                  onChange={(e) => setInboxCategory(e.target.value)}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "var(--glass-border)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "0.6rem",
                    width: "100%",
                    outline: "none"
                  }}
                >
                  <option value="" style={{ background: "#1b0b30" }}>All Categories</option>
                  <option value="healthcare" style={{ background: "#1b0b30" }}>Healthcare</option>
                  <option value="fitness" style={{ background: "#1b0b30" }}>Fitness</option>
                  <option value="real_estate" style={{ background: "#1b0b30" }}>Real Estate</option>
                  <option value="recruitment" style={{ background: "#1b0b30" }}>Recruitment</option>
                  <option value="education" style={{ background: "#1b0b30" }}>Education</option>
                  <option value="finance" style={{ background: "#1b0b30" }}>Finance</option>
                  <option value="beauty" style={{ background: "#1b0b30" }}>Beauty</option>
                  <option value="technology" style={{ background: "#1b0b30" }}>Technology</option>
                  <option value="general" style={{ background: "#1b0b30" }}>General</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Min Buying Intent Score ({inboxMinIntent || "0"})</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={inboxMinIntent}
                  onChange={(e) => setInboxMinIntent(e.target.value)}
                  style={{
                    width: "100%",
                    accentColor: "var(--color-primary)",
                    marginTop: "0.5rem"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Inbox Loading / Errors */}
          {inboxLoading && (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
              <p style={{ color: "var(--color-text-dim)" }}>Analyzing leads inbox...</p>
            </div>
          )}

          {inboxError && <div className="toast toast-error">{inboxError}</div>}

          {/* Summary Stats Bar */}
          {!inboxLoading && !inboxError && qualifiedLeads.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total Leads", value: qualifiedLeads.length, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)" },
                { label: "🔥 Hot (>60% intent)", value: highPriorityLeads.length, color: "#ff4566", bg: "rgba(255, 69, 102, 0.1)" },
                { label: "⚡ Warm (30–60%)", value: mediumPriorityLeads.length, color: "#ffd166", bg: "rgba(255, 209, 102, 0.1)" },
                { label: "🔵 Watchlist (<30%)", value: lowPriorityLeads.length, color: "#00baff", bg: "rgba(0, 186, 255, 0.1)" },
              ].map(stat => (
                <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.color}30`, borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", marginTop: "0.25rem" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* CRM Kanban Columns / Priority groupings */}
          {!inboxLoading && !inboxError && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
              alignItems: "start"
            }}>
              {/* High Column */}
              <div className="glass-card" style={{ background: "rgba(255, 69, 102, 0.03)", padding: "1.25rem", borderTop: "4px solid #ff4566" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#ff4566", margin: 0 }}>🔥 Contact Immediately</h3>
                  <span style={{ background: "rgba(255, 69, 102, 0.15)", color: "#ff4566", padding: "0.2rem 0.5rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "bold" }}>
                    {highPriorityLeads.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "150px" }}>
                  {highPriorityLeads.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: "2rem 0", fontSize: "0.9rem" }}>No high priority leads.</div>
                  ) : (
                    highPriorityLeads.map(lead => {
                      const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === lead.username.toLowerCase());
                      return (
                        <div key={lead._id} className="glass-card" style={{ padding: "1rem", background: "rgba(255, 255, 255, 0.02)", border: "var(--glass-border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>@{lead.username}</span>
                            <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#ff4566", background: "rgba(255,69,102,0.15)", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>
                              {lead.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Problem:</strong> {lead.problem}</p>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Service:</strong> {lead.serviceNeeded}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>🎯 Intent: {lead.buyingIntent}% | Score: {lead.leadScore}</span>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => fetchInboxLeadDetails(lead.username)}
                                className="btn btn-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                              >
                                Details
                              </button>
                              {inCrm ? (
                                <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.75rem", alignSelf: "center" }}>✅ In CRM</span>
                              ) : (
                                <button
                                  onClick={() => handleAddToCrm(lead.username)}
                                  className="btn btn-primary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                                >
                                  Add to CRM
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Medium Column */}
              <div className="glass-card" style={{ background: "rgba(255, 182, 0, 0.03)", padding: "1.25rem", borderTop: "4px solid #ffb600" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#ffb600", margin: 0 }}>⚡ Monitor Regularly</h3>
                  <span style={{ background: "rgba(255, 182, 0, 0.15)", color: "#ffb600", padding: "0.2rem 0.5rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "bold" }}>
                    {mediumPriorityLeads.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "150px" }}>
                  {mediumPriorityLeads.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: "2rem 0", fontSize: "0.9rem" }}>No medium priority leads.</div>
                  ) : (
                    mediumPriorityLeads.map(lead => {
                      const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === lead.username.toLowerCase());
                      return (
                        <div key={lead._id} className="glass-card" style={{ padding: "1rem", background: "rgba(255, 255, 255, 0.02)", border: "var(--glass-border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>@{lead.username}</span>
                            <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#ffb600", background: "rgba(255,182,0,0.15)", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>
                              {lead.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Problem:</strong> {lead.problem}</p>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Service:</strong> {lead.serviceNeeded}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>🎯 Intent: {lead.buyingIntent}% | Score: {lead.leadScore}</span>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => fetchInboxLeadDetails(lead.username)}
                                className="btn btn-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                              >
                                Details
                              </button>
                              {inCrm ? (
                                <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.75rem", alignSelf: "center" }}>✅ In CRM</span>
                              ) : (
                                <button
                                  onClick={() => handleAddToCrm(lead.username)}
                                  className="btn btn-primary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                                >
                                  Add to CRM
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Low Column */}
              <div className="glass-card" style={{ background: "rgba(0, 186, 255, 0.03)", padding: "1.25rem", borderTop: "4px solid #00baff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#00baff", margin: 0 }}>🕒 Low Priority / Watchlist</h3>
                  <span style={{ background: "rgba(0, 186, 255, 0.15)", color: "#00baff", padding: "0.2rem 0.5rem", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "bold" }}>
                    {lowPriorityLeads.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "150px" }}>
                  {lowPriorityLeads.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: "2rem 0", fontSize: "0.9rem" }}>No low priority leads.</div>
                  ) : (
                    lowPriorityLeads.map(lead => {
                      const inCrm = crmLeads.some(cl => cl.username.toLowerCase() === lead.username.toLowerCase());
                      return (
                        <div key={lead._id} className="glass-card" style={{ padding: "1rem", background: "rgba(255, 255, 255, 0.02)", border: "var(--glass-border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>@{lead.username}</span>
                            <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#00baff", background: "rgba(0,186,255,0.15)", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>
                              {lead.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Problem:</strong> {lead.problem}</p>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee" }}><strong>Service:</strong> {lead.serviceNeeded}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>🎯 Intent: {lead.buyingIntent}% | Score: {lead.leadScore}</span>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => fetchInboxLeadDetails(lead.username)}
                                className="btn btn-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                              >
                                Details
                              </button>
                              {inCrm ? (
                                <span style={{ color: "var(--color-success)", fontWeight: "bold", fontSize: "0.75rem", alignSelf: "center" }}>✅ In CRM</span>
                              ) : (
                                <button
                                  onClick={() => handleAddToCrm(lead.username)}
                                  className="btn btn-primary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}
                                >
                                  Add to CRM
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="settings-container animate-fade-in" style={{ padding: "0 1rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Page Help / Description Panel */}
          <div className="glass-card page-description-banner">
            <h3>⚙️ System Configurations & Customization</h3>
            <p>
              Tune scraping post limits, comment count depth, following overlap weights, AI gate parameters, and API credentials. Keep target scanning paused or active.
            </p>
          </div>

          <div className="settings-grid-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            {/* Target monitor configurations */}
            <div className="glass-card card-table" style={{ padding: "1.5rem" }}>
              <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>⚙️ Monitored Targets</h2>
              <p style={{ color: "var(--color-text-dim)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                Enable or pause periodic target scanning and check frequency updates.
              </p>

              {monitoringLoading && (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                  <p style={{ color: "var(--color-text-dim)" }}>Loading configurations...</p>
                </div>
              )}
              {monitoringError && <div className="toast toast-error">{monitoringError}</div>}

              {!monitoringLoading && !monitoringError && monitoringConfigs.length === 0 ? (
                <p style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "2rem 0" }}>
                  No configurations found. Run a scraper or discovery pipeline to initialize.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Last Checked</th>
                        <th>Checks</th>
                        <th>Changes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringConfigs.map((config) => (
                        <tr key={config.username} className="lead-row">
                          <td style={{ fontWeight: "bold" }}>@{config.username}</td>
                          <td>
                            <span className={`status-badge ${config.monitoringEnabled ? "status-completed" : "status-failed"}`}>
                              {config.monitoringEnabled ? "ACTIVE" : "PAUSED"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
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
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", margin: 0, minWidth: "auto" }}
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

            {/* Pipeline engine settings */}
            <div className="glass-card" style={{ padding: "1.5rem" }}>
              <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>🔧 Pipeline Parameters</h2>
              <p style={{ color: "var(--color-text-dim)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                Configure scraper scroll depths, following boost multipliers, and AI gate thresholds.
              </p>

              {sysSettingsSaveSuccess && <div className="toast toast-success" style={{ marginBottom: "1rem" }}>{sysSettingsSaveSuccess}</div>}
              {sysSettingsError && <div className="toast toast-error" style={{ marginBottom: "1rem" }}>{sysSettingsError}</div>}

              <form onSubmit={handleSaveSysSettings} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>Max Profile Posts</label>
                    <input
                      type="number"
                      value={sysSettings.maxPostsScraped}
                      onChange={(e) => setSysSettings({ ...sysSettings, maxPostsScraped: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>Max Hashtag Posts</label>
                    <input
                      type="number"
                      value={sysSettings.maxHashtagPosts}
                      onChange={(e) => setSysSettings({ ...sysSettings, maxHashtagPosts: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>Max Post Comments</label>
                    <input
                      type="number"
                      value={sysSettings.maxCommentsScraped}
                      onChange={(e) => setSysSettings({ ...sysSettings, maxCommentsScraped: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>Following Boost Weight</label>
                    <input
                      type="number"
                      value={sysSettings.followingBoostWeight}
                      onChange={(e) => setSysSettings({ ...sysSettings, followingBoostWeight: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>AI Intent Threshold (60-100)</label>
                    <input
                      type="number"
                      value={sysSettings.intentThreshold}
                      onChange={(e) => setSysSettings({ ...sysSettings, intentThreshold: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>Immediate Action (80-100)</label>
                    <input
                      type="number"
                      value={sysSettings.immediateContactThreshold}
                      onChange={(e) => setSysSettings({ ...sysSettings, immediateContactThreshold: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>AI Provider</label>
                    <select
                      value={sysSettings.aiProvider}
                      onChange={(e) => setSysSettings({ ...sysSettings, aiProvider: e.target.value })}
                      className="form-control"
                      style={{ width: "100%", height: "38px", background: "rgba(9,6,17,0.8)", border: "var(--glass-border)", color: "#fff", borderRadius: "8px", padding: "0 0.5rem" }}
                    >
                      <option value="gemini">Gemini AI</option>
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter (Llama 3)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>LLM Temperature (0.0-1.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={sysSettings.temperature}
                      onChange={(e) => setSysSettings({ ...sysSettings, temperature: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>API Secret Keys (Override defaults)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <input
                      type="password"
                      placeholder="Gemini API Key"
                      value={sysSettings.geminiApiKey || ""}
                      onChange={(e) => setSysSettings({ ...sysSettings, geminiApiKey: e.target.value })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                    <input
                      type="password"
                      placeholder="OpenAI API Key"
                      value={sysSettings.openaiApiKey || ""}
                      onChange={(e) => setSysSettings({ ...sysSettings, openaiApiKey: e.target.value })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                    <input
                      type="password"
                      placeholder="OpenRouter API Key"
                      value={sysSettings.openrouterApiKey || ""}
                      onChange={(e) => setSysSettings({ ...sysSettings, openrouterApiKey: e.target.value })}
                      className="form-control"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sysSettingsLoading}
                  className="btn btn-primary"
                  style={{ marginTop: "1rem", alignSelf: "flex-end" }}
                >
                  {sysSettingsLoading ? "Saving..." : "Save Configs"}
                </button>
              </form>
            </div>
          </div>

          {/* Developer Settings Card */}
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "0.5rem" }}>🛠️ Developer Configuration</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label className="switch" style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isDevMode}
                  onChange={(e) => {
                    setIsDevMode(e.target.checked);
                    localStorage.setItem("isDevMode", e.target.checked ? "true" : "false");
                  }}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.9rem", color: "#fff", fontWeight: "bold" }}>Enable Developer Mode Panel</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="logs-container animate-fade-in" style={{ padding: "0 1rem" }}>
          <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "#fff" }}>📋 Worker Console Logs</h2>
                <p style={{ margin: "0.25rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.9rem" }}>
                  Monitor standard output and execution steps for active scraper and discovery workers in real-time.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-dim)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={logsAutoRefresh}
                    onChange={(e) => setLogsAutoRefresh(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  Auto-refresh (2s)
                </label>
                <button
                  onClick={() => fetchWorkerLogs(selectedWorker)}
                  className="btn btn-secondary"
                  style={{ minWidth: "auto", margin: 0, padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  🔄 Refresh Now
                </button>
                <button
                  onClick={() => handleClearLogs(selectedWorker)}
                  className="btn btn-secondary"
                  style={{ minWidth: "auto", margin: 0, padding: "0.4rem 0.8rem", fontSize: "0.85rem", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", background: "rgba(239, 68, 68, 0.02)" }}
                >
                  🧹 Clear Log History
                </button>
              </div>
            </div>

            {/* Worker Selection Tabs & Search bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255, 255, 255, 0.03)", padding: "0.25rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <button
                  onClick={() => setSelectedWorker("scraper")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "scraper" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "scraper" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🕸️ Scraper Worker
                </button>
                <button
                  onClick={() => setSelectedWorker("influencer-discovery")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "influencer-discovery" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "influencer-discovery" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🎯 Influencer Discover Worker
                </button>
                <button
                  onClick={() => setSelectedWorker("comment-scraper")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "comment-scraper" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "comment-scraper" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  💬 Comment Scraper
                </button>
                <button
                  onClick={() => setSelectedWorker("comment-analyzer")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "comment-analyzer" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "comment-analyzer" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🤖 Comment Analyzer
                </button>
                <button
                  onClick={() => setSelectedWorker("analysis")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "analysis" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "analysis" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🧠 Analyze Worker
                </button>
                <button
                  onClick={() => setSelectedWorker("embedding")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "embedding" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "embedding" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🧬 Embedding Worker
                </button>
                <button
                  onClick={() => setSelectedWorker("intelligence")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "intelligence" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "intelligence" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  💡 Intel Worker
                </button>
                <button
                  onClick={() => setSelectedWorker("qualification")}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedWorker === "qualification" ? "rgba(0, 186, 255, 0.15)" : "transparent",
                    color: selectedWorker === "qualification" ? "var(--color-accent)" : "var(--color-text-dim)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🏆 Qualify Worker
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="🔍 Filter log content..."
                  value={logsSearchTerm}
                  onChange={(e) => setLogsSearchTerm(e.target.value)}
                  className="input-field"
                  style={{ width: "250px", margin: 0, padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                />
              </div>
            </div>
          </div>

          {/* Terminal Console View */}
          <div
            style={{
              background: "#0c0e12",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1.5rem",
              fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
              fontSize: "0.85rem",
              lineHeight: "1.5",
              color: "#e2e8f0",
              height: "60vh",
              overflowY: "auto",
              boxShadow: "inset 0 4px 20px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem"
            }}
          >
            {(() => {
              const filtered = workerLogs.filter(log =>
                log.message.toLowerCase().includes(logsSearchTerm.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <div style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "4rem 0" }}>
                    {logsSearchTerm ? "No logs matching current filter" : `No logs captured for "${selectedWorker}" worker.`}
                  </div>
                );
              }

              return filtered.map((log, index) => {
                const dateStr = new Date(log.timestamp).toLocaleTimeString();

                // Determine message color based on log level/message text
                let msgColor = "#e2e8f0";
                if (log.level === "error" || log.message.toLowerCase().includes("fail") || log.message.toLowerCase().includes("error")) {
                  msgColor = "#ff4566";
                } else if (log.level === "warn") {
                  msgColor = "#ffb600";
                } else if (log.message.startsWith("STEP")) {
                  msgColor = "#00baff";
                } else if (log.message.toLowerCase().includes("success") || log.message.toLowerCase().includes("finished")) {
                  msgColor = "#22c55e";
                }

                return (
                  <div key={log._id || index} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", wordBreak: "break-all" }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.25)", minWidth: "70px", userSelect: "none" }}>[{dateStr}]</span>
                    <span style={{ color: log.level === "error" ? "#ff4566" : log.level === "warn" ? "#ffb600" : "#a1a1aa", minWidth: "45px", fontWeight: "bold", userSelect: "none" }}>
                      {log.level.toUpperCase()}
                    </span>
                    <span style={{ color: msgColor, flex: 1 }}>{log.message}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {activeTab === "developer" && (
        <div className="developer-container animate-fade-in" style={{ padding: "0 1rem" }}>
          {/* Page Help / Description Panel */}
          <div className="glass-card page-description-banner" style={{ marginBottom: "1.5rem" }}>
            <h3>🛠️ Developer Operations Console</h3>
            <p>
              Simulate edge cases, trigger test scenarios, reset queues, and debug state variables without using live Instagram API sessions.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", alignItems: "start" }}>

            {/* Left Column: Feature Testing Deck */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Feature Test Grid */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <h3 className="card-title" style={{ fontSize: "1.4rem", margin: 0 }}>🛠️ Feature Test Deck</h3>
                  <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                    Simulate edge cases, constraints, and stability behaviors locally without using live Instagram API sessions.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

                  {/* Card 1: 12-Post Cap */}
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>📝</span>
                        <span style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.15)", color: "var(--color-success)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 1</span>
                      </div>
                      <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "bold", margin: "0 0 0.25rem 0" }}>12-Post Scraping Cap</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                        Simulates a profile scrape. Caps extraction and saving at exactly 12 posts.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTriggerScenarioDirect("success", "cap_limit_user")}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem", fontSize: "0.8rem", width: "100%", margin: 0 }}
                      disabled={devSubmitting}
                    >
                      🚀 Run Test (@cap_limit_user)
                    </button>
                  </div>

                  {/* Card 2: Private Account Skip */}
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>🔒</span>
                        <span style={{ fontSize: "0.7rem", background: "rgba(245, 158, 11, 0.15)", color: "var(--color-warning)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 3</span>
                      </div>
                      <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "bold", margin: "0 0 0.25rem 0" }}>Private Account Skip</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                        Arrives at private account, skips execution, and saves skip reason.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTriggerScenarioDirect("private-account", "private_user")}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem", fontSize: "0.8rem", width: "100%", margin: 0 }}
                      disabled={devSubmitting}
                    >
                      🚀 Run Test (@private_user)
                    </button>
                  </div>

                  {/* Card 3: Large Account Skip */}
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>📈</span>
                        <span style={{ fontSize: "0.7rem", background: "rgba(239, 68, 68, 0.15)", color: "var(--color-error)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 3</span>
                      </div>
                      <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "bold", margin: "0 0 0.25rem 0" }}>Large Account Skip</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                        Detects post count &gt; 500, skips account, and saves skip reason.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTriggerScenarioDirect("large-account", "large_influencer_user")}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem", fontSize: "0.8rem", width: "100%", margin: 0 }}
                      disabled={devSubmitting}
                    >
                      🚀 Run Test (@large_influencer_user)
                    </button>
                  </div>

                  {/* Card 4: Scraper Timeout */}
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>⏱️</span>
                        <span style={{ fontSize: "0.7rem", background: "rgba(59, 130, 246, 0.15)", color: "var(--color-info)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 2</span>
                      </div>
                      <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "bold", margin: "0 0 0.25rem 0" }}>Scraper Timeout (60s)</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                        Simulates browser hang. Aborts after 60s timeout and records skip.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTriggerScenarioDirect("timeout", "timeout_stuck_user")}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem", fontSize: "0.8rem", width: "100%", margin: 0 }}
                      disabled={devSubmitting}
                    >
                      🚀 Run Test (@timeout_stuck_user)
                    </button>
                  </div>

                  {/* Card 5: Retry & Backoff */}
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem", gridColumn: "span 2" }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "1.5rem" }}>🔄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                          <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "bold", margin: 0 }}>Retry Strategy (2 Attempts + Backoff)</h4>
                          <span style={{ fontSize: "0.7rem", background: "rgba(124, 34, 228, 0.15)", color: "#c084fc", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 4</span>
                        </div>
                        <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                          Simulates temporary connection errors. BullMQ automatically retries the job up to 2 times with a 5-second exponential delay.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTriggerScenarioDirect("failure", "transient_fail_user")}
                      className="btn btn-primary"
                      style={{ padding: "0.45rem", fontSize: "0.85rem", width: "100%", margin: 0 }}
                      disabled={devSubmitting}
                    >
                      🚀 Run Retry & Backoff Test (@transient_fail_user)
                    </button>
                  </div>

                </div>

                {/* Bulk Concurrency Simulator */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold", margin: 0 }}>⚡ Bulk Concurrency Simulator</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: "0.15rem 0 0 0" }}>
                        Triggers 5 jobs at once. Verifies active concurrency set to 5 parallel workers.
                      </p>
                    </div>
                    <span style={{ fontSize: "0.7rem", background: "rgba(0, 216, 255, 0.15)", color: "var(--color-accent)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: "bold" }}>Task 5</span>
                  </div>
                  <button
                    onClick={handleTriggerConcurrencyTest}
                    className="btn btn-secondary"
                    style={{ border: "1px solid rgba(0, 216, 255, 0.3)", color: "var(--color-accent)", background: "rgba(0, 216, 255, 0.03)" }}
                    disabled={devSubmitting}
                  >
                    🔥 Launch 5 Parallel Mock Jobs
                  </button>
                </div>

                {/* Seed Influencer Scenarios */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold", margin: 0 }}>🎯 Seed Influencer Discovery Mocks</h4>
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: "0.15rem 0 0 0" }}>
                        Simulate influencer discovery scanning and lead extraction cycles.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={async () => {
                        setDevError(null);
                        setDevSuccessMessage(null);
                        setDevSubmitting(true);
                        try {
                          const res = await fetch(`${API_BASE_URL}/dev/test-influencer-discovery/influencer-success`, { method: "POST" });
                          if (!res.ok) throw new Error("Failed to trigger mock success run");
                          setDevSuccessMessage("Simulated seed influencer success scan triggered!");
                          fetchInfluencers();
                        } catch (err) {
                          setDevError(err instanceof Error ? err.message : "Error triggering scan");
                        } finally {
                          setDevSubmitting(false);
                        }
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1, border: "1px solid rgba(34, 197, 94, 0.3)", color: "#22c55e", background: "rgba(34, 197, 94, 0.03)" }}
                      disabled={devSubmitting}
                    >
                      🚀 Success Run (@test_influencer)
                    </button>
                    <button
                      onClick={async () => {
                        setDevError(null);
                        setDevSuccessMessage(null);
                        setDevSubmitting(true);
                        try {
                          const res = await fetch(`${API_BASE_URL}/dev/test-influencer-discovery/influencer-private`, { method: "POST" });
                          if (!res.ok) throw new Error("Failed to trigger mock private run");
                          setDevSuccessMessage("Simulated seed influencer private skip triggered!");
                          fetchInfluencers();
                        } catch (err) {
                          setDevError(err instanceof Error ? err.message : "Error triggering scan");
                        } finally {
                          setDevSubmitting(false);
                        }
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      disabled={devSubmitting}
                    >
                      🔒 Private Skip
                    </button>
                    <button
                      onClick={async () => {
                        setDevError(null);
                        setDevSuccessMessage(null);
                        setDevSubmitting(true);
                        try {
                          const res = await fetch(`${API_BASE_URL}/dev/test-influencer-discovery/influencer-no-posts`, { method: "POST" });
                          if (!res.ok) throw new Error("Failed to trigger mock no-posts run");
                          setDevSuccessMessage("Simulated seed influencer no posts skip triggered!");
                          fetchInfluencers();
                        } catch (err) {
                          setDevError(err instanceof Error ? err.message : "Error triggering scan");
                        } finally {
                          setDevSubmitting(false);
                        }
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      disabled={devSubmitting}
                    >
                      📭 No Posts Skip
                    </button>
                  </div>
                </div>

              </div>

              {/* Toast messages */}
              {devError && <div className="toast toast-error" style={{ margin: 0 }}>{devError}</div>}
              {devSuccessMessage && (
                <div className="toast toast-success" style={{ margin: 0, background: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.25)" }}>
                  {devSuccessMessage}
                </div>
              )}

              {/* Queue Maintenance Panel */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 className="card-title" style={{ fontSize: "1.1rem", margin: 0, color: "#fff" }}>🧹 Queue Maintenance</h3>
                <p style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", margin: 0, lineHeight: "1.4" }}>
                  Drain and flush all waiting, active, completed, and failed jobs inside BullMQ.
                </p>
                <button
                  onClick={handleClearQueues}
                  className="btn btn-secondary"
                  style={{ border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", background: "rgba(239, 68, 68, 0.02)" }}
                  disabled={devSubmitting}
                >
                  Clear & Drain BullMQ Queues
                </button>
              </div>

            </div>

            {/* Right Column: Jobs Pipeline Monitor */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Queue Stats Counters */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0 }}>⚙️ Queue Status</h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "0.75rem", textAlign: "center", borderLeft: "3px solid #ffb600" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.7rem", textTransform: "uppercase" }}>Waiting</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#ffb600" }}>{queueStats?.waiting || 0}</div>
                  </div>
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "0.75rem", textAlign: "center", borderLeft: "3px solid #00baff" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.7rem", textTransform: "uppercase" }}>Active (Working)</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#00baff" }}>{queueStats?.active || 0}</div>
                  </div>
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "0.75rem", textAlign: "center", borderLeft: "3px solid #22c55e" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.7rem", textTransform: "uppercase" }}>Completed</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#22c55e" }}>{queueStats?.completed || 0}</div>
                  </div>
                  <div className="glass-card" style={{ background: "rgba(255, 255, 255, 0.01)", padding: "0.75rem", textAlign: "center", borderLeft: "3px solid #ff4566" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.7rem", textTransform: "uppercase" }}>Failed</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#ff4566" }}>{queueStats?.failed || 0}</div>
                  </div>
                </div>
              </div>

              {/* Jobs Monitor Table */}
              <div className="glass-card card-table" style={{ margin: 0, minHeight: "400px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 className="card-title" style={{ fontSize: "1.2rem", margin: 0 }}>📊 Pipeline Telemetry</h3>
                  <button onClick={fetchAllJobs} className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", minWidth: "auto", margin: 0 }}>
                    🔄 Refresh
                  </button>
                </div>

                {jobsLoading && allJobs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem" }}>
                    <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                    <p style={{ color: "var(--color-text-dim)", fontSize: "0.85rem" }}>Loading jobs...</p>
                  </div>
                ) : allJobs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-dim)" }}>
                    <span style={{ fontSize: "2rem" }}>📭</span>
                    <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>No jobs tracked in the queue.</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: "450px", overflowY: "auto" }}>
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th>Target</th>
                          <th>Status</th>
                          <th>Progress</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allJobs.slice(0, 15).map((j) => {
                          const getStatusBadge = (state: string) => {
                            const s = state.toLowerCase();
                            if (s === "completed") return <span className="status-badge status-completed">Completed</span>;
                            if (s === "active") return <span className="status-badge status-active" style={{ background: "#00baff15", color: "#00baff", borderColor: "#00baff" }}>Working</span>;
                            if (s === "waiting") return <span className="status-badge status-delayed" style={{ background: "#ffb60015", color: "#ffb600", borderColor: "#ffb600" }}>Waiting</span>;
                            if (s === "failed") return <span className="status-badge status-failed">Failed</span>;
                            return <span className="status-badge">{state.toUpperCase()}</span>;
                          };

                          const formatProgress = () => {
                            if (j.state === "completed") return "100%";
                            if (j.state === "failed") return "Failed";
                            if (typeof j.progress === "object" && j.progress !== null) {
                              return `${j.progress.percent || 0}%`;
                            }
                            return `${j.progress || 0}%`;
                          };

                          return (
                            <tr key={j.id} className="lead-row" style={{ fontSize: "0.8rem" }}>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                  <strong style={{ color: "#fff" }}>
                                    {(() => {
                                      if (j.queue === "discovery") return `#${j.data?.hashtag || "unknown"}`;
                                      if (j.queue === "influencer-discovery") return "All Active Seeds";
                                      if (j.queue === "comment-scrape") {
                                        const url = j.data?.postUrl || "";
                                        const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
                                        return match ? `Post/Reel: ${match[1]}` : "Post URL";
                                      }
                                      return `@${j.data?.username || "unknown"}`;
                                    })()}
                                  </strong>
                                  <div style={{
                                    alignSelf: "flex-start",
                                    fontSize: "0.65rem",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "var(--glass-border)",
                                    padding: "0.1rem 0.3rem",
                                    borderRadius: "4px",
                                    color: "var(--color-text-dim)",
                                    textTransform: "capitalize",
                                    fontWeight: "bold"
                                  }}>
                                    {j.queue}
                                  </div>
                                </div>
                                {j.state === "active" && j.processedOn && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)", marginTop: "0.1rem" }}>
                                    Elapsed: {Math.floor((Date.now() - j.processedOn) / 1000)}s
                                  </div>
                                )}
                              </td>
                              <td>{getStatusBadge(j.state)}</td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                                  <span>{formatProgress()}</span>
                                  {j.state === "active" && typeof j.progress === "object" && j.progress !== null && j.progress.stage && (
                                    <span style={{ fontSize: "0.7rem", color: "var(--color-accent)" }}>{j.progress.stage}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {(() => {
                                  if (j.state === "failed") return <span style={{ color: "#ff4566" }}>Scrape Error</span>;
                                  const rv = j.returnvalue;
                                  const rvStatus = rv?.status?.toUpperCase();
                                  if (j.state === "completed" && rv && rvStatus === "SKIPPED") {
                                    const r = (rv.reason || "").toUpperCase();
                                    if (r === "TIMEOUT") return <span style={{ color: "#ffb600" }}>⏱ Timeout</span>;
                                    if (r === "SKIPPED_LARGE_ACCOUNT") return <span style={{ color: "#ff4566" }}>Large Account</span>;
                                    if (r === "PRIVATE_ACCOUNT" || r === "PRIVATE ACCOUNT") return <span style={{ color: "#ffb600" }}>Private Account</span>;
                                    if (r === "NO_POSTS_FOUND" || r === "NO_POST_URLS_FOUND") return <span style={{ color: "#ffb600" }}>No Post URLs Found</span>;
                                    return <span style={{ color: "var(--color-text-dim)" }}>{rv.reason || "Skipped"}</span>;
                                  }
                                  return <span style={{ color: "var(--color-text-dim)" }}>—</span>;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {activeTab === "crm" && (
        <div className="crm-container animate-fade-in" style={{ padding: "0 1rem" }}>

          {/* Header/Controls bar */}
          <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "#fff" }}>💼 CRM Lead Pipeline</h2>
                <p style={{ margin: "0.25rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.9rem" }}>
                  Manage status stages, assignees, tags, and internal notes for qualified leads.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => fetchCrmData()}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  disabled={crmLoading}
                >
                  🔄 Refresh CRM Data
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-dim)", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  Filter by Status
                </label>
                <select
                  value={crmFilterStatus}
                  onChange={(e) => setCrmFilterStatus(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", margin: 0 }}
                >
                  <option value="">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-dim)", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  Filter by Priority
                </label>
                <select
                  value={crmFilterPriority}
                  onChange={(e) => setCrmFilterPriority(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", margin: 0 }}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-dim)", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  Filter by Assignee
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alice"
                  value={crmFilterAssignedTo}
                  onChange={(e) => setCrmFilterAssignedTo(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", margin: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Analytical Status Overview Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #fff" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>New</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#fff" }}>
                {crmStats?.new || 0}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid var(--color-accent)" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>Contacted</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-accent)" }}>
                {crmStats?.contacted || 0}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid var(--color-primary)" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>Interested / Qualified</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-primary)" }}>
                {(crmStats?.interested || 0) + (crmStats?.qualified || 0)}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #22c55e" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>Converted</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#22c55e" }}>
                {crmStats?.converted || 0}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #ff4566" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>Lost</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#ff4566" }}>
                {crmStats?.lost || 0}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center", borderTop: "3px solid #eab308" }}>
              <div style={{ color: "var(--color-text-dim)", fontSize: "0.8rem", textTransform: "uppercase" }}>Conversion Rate</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#eab308" }}>
                {crmStats?.conversionRate != null ? `${crmStats.conversionRate.toFixed(1)}%` : "0.0%"}
              </div>
            </div>
          </div>

          {crmError && <div className="toast toast-error">{crmError}</div>}

          {crmLoading ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
              <p style={{ color: "var(--color-text-dim)" }}>Loading CRM Pipeline...</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

              {/* Left Column: High Priority Queue & Activity Feed */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* High Priority leads panel */}
                <div className="glass-card" style={{ padding: "1.25rem", borderLeft: "4px solid #ff4566" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#fff", marginTop: 0, marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🔥 High Priority Leads</span>
                    <span style={{ fontSize: "0.75rem", background: "rgba(255, 69, 102, 0.15)", color: "#ff4566", padding: "0.15rem 0.4rem", borderRadius: "8px" }}>
                      {crmLeads.filter(l => l.priority === "high").length}
                    </span>
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.25rem" }}>
                    {crmLeads
                      .filter(l => l.priority === "high")
                      .sort((a, b) => b.buyingIntent - a.buyingIntent || b.leadScore - a.leadScore || new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
                      .map(lead => renderCrmLeadCard(lead))}
                    {crmLeads.filter(l => l.priority === "high").length === 0 && (
                      <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: "1.5rem 0", fontSize: "0.85rem" }}>
                        No high priority leads.
                      </div>
                    )}
                  </div>
                </div>

                {/* Global Activity Feed */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#fff", marginTop: 0, marginBottom: "1rem" }}>
                    📜 Global CRM Activity
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "350px", overflowY: "auto", paddingRight: "0.25rem" }}>
                    {crmActivity.map((act) => {
                      const displayType = (type: string) => {
                        switch (type) {
                          case "created": return "🆕 Created";
                          case "assigned": return "👤 Assigned";
                          case "note_added": return "📝 Note Added";
                          case "status_changed": return "⚡ Stage Change";
                          case "converted": return "🎉 Converted";
                          case "lost": return "❌ Lost";
                          case "escalated": return "🔥 Escalated";
                          default: return type;
                        }
                      };
                      return (
                        <div key={act._id} style={{
                          fontSize: "0.8rem",
                          padding: "0.5rem 0.75rem",
                          background: "rgba(255,255,255,0.01)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: "6px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", color: "#fff", marginBottom: "0.15rem" }}>
                            <span>@{act.username}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--color-accent)" }}>{displayType(act.type)}</span>
                          </div>
                          {act.type === "status_changed" && (
                            <div style={{ color: "var(--color-text-dim)" }}>
                              Status: <span style={{ textDecoration: "line-through" }}>{act.oldValue}</span> → <strong>{act.newValue}</strong>
                            </div>
                          )}
                          {act.type === "assigned" && (
                            <div style={{ color: "var(--color-text-dim)" }}>
                              Assignee: <span style={{ textDecoration: "line-through" }}>{act.oldValue || "Unassigned"}</span> → <strong>{act.newValue || "Unassigned"}</strong>
                            </div>
                          )}
                          {act.type === "note_added" && (
                            <div style={{ color: "#eee", fontStyle: "italic" }}>
                              "{act.newValue}"
                            </div>
                          )}
                          {act.type === "escalated" && (
                            <div style={{ color: "#ff4566" }}>
                              Score increased by <strong>{act.newValue}</strong> pts! Priority escalated.
                            </div>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)", marginTop: "0.25rem", textAlign: "right" }}>
                            {new Date(act.createdAt).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                    {crmActivity.length === 0 && (
                      <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: "1.5rem 0", fontSize: "0.85rem" }}>
                        No CRM activities logged.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Kanban board grid */}
              <div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: "0.75rem",
                  alignItems: "start",
                  overflowX: "auto",
                  paddingBottom: "1rem"
                }}>

                  {/* Status Columns mapping */}
                  {(["new", "contacted", "interested", "qualified", "converted", "lost"] as const).map((colStatus) => {
                    const leadsInCol = crmLeads.filter(l => l.status === colStatus);

                    const getColColor = (status: string) => {
                      switch (status) {
                        case "new": return "#fff";
                        case "contacted": return "var(--color-accent)";
                        case "interested": return "var(--color-primary)";
                        case "qualified": return "#7c22e4";
                        case "converted": return "#22c55e";
                        case "lost": return "#ff4566";
                        default: return "#fff";
                      }
                    };

                    const getColTitle = (status: string) => {
                      switch (status) {
                        case "new": return "New";
                        case "contacted": return "Contacted";
                        case "interested": return "Interested";
                        case "qualified": return "Qualified";
                        case "converted": return "Converted";
                        case "lost": return "Lost";
                        default: return status;
                      }
                    };

                    return (
                      <div
                        key={colStatus}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const username = e.dataTransfer.getData("text/plain");
                          if (username) {
                            handleUpdateCrmStatus(username, colStatus);
                          }
                        }}
                        className="glass-card"
                        style={{
                          background: "rgba(255, 255, 255, 0.01)",
                          border: "var(--glass-border)",
                          borderTop: `4px solid ${getColColor(colStatus)}`,
                          padding: "0.75rem",
                          minHeight: "500px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: getColColor(colStatus) }}>
                            {getColTitle(colStatus)}
                          </span>
                          <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "6px" }}>
                            {leadsInCol.length}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, overflowY: "auto", maxHeight: "600px" }}>
                          {leadsInCol.map(lead => renderCrmLeadCard(lead))}
                          {leadsInCol.length === 0 && (
                            <div style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--color-text-dim)",
                              fontSize: "0.75rem",
                              border: "1px dashed rgba(255,255,255,0.05)",
                              borderRadius: "6px",
                              padding: "2rem 0",
                              textAlign: "center"
                            }}>
                              Drag leads here
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Qualified Lead Deep-dive Modal */}
      {selectedInboxLeadUsername && (
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
          onClick={() => setSelectedInboxLeadUsername(null)}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              position: "relative",
              animation: "fade-in 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedInboxLeadUsername(null)}
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

            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📋 Lead Qualification: @{selectedInboxLeadUsername}
            </h2>

            {selectedInboxLeadLoading && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                <p style={{ color: "var(--color-text-dim)" }}>Loading qualification profile...</p>
              </div>
            )}

            {selectedInboxLeadError && <div className="toast toast-error">{selectedInboxLeadError}</div>}

            {selectedInboxLeadDetails && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>

                {/* Metrics Row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "1rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "var(--glass-border)",
                  borderRadius: "8px"
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Lead Score</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-primary)" }}>
                      {selectedInboxLeadDetails.qualification.leadScore}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Buying Intent</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-accent)" }}>
                      {selectedInboxLeadDetails.qualification.buyingIntent}%
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Urgency</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: selectedInboxLeadDetails.qualification.urgency === "high" ? "#ff4566" : selectedInboxLeadDetails.qualification.urgency === "medium" ? "#ffb600" : "#00baff" }}>
                      {selectedInboxLeadDetails.qualification.urgency.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Confidence</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#fff" }}>
                      {selectedInboxLeadDetails.qualification.confidence}%
                    </div>
                  </div>
                </div>

                {/* Qualification Details */}
                <div className="glass-card" style={{ padding: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                    🔍 AI Qualification Profile
                  </h3>
                  <p style={{ margin: "0.4rem 0" }}><strong>Core Problem:</strong> {selectedInboxLeadDetails.qualification.problem}</p>
                  <p style={{ margin: "0.4rem 0" }}><strong>Service Required:</strong> {selectedInboxLeadDetails.qualification.serviceNeeded}</p>
                  <p style={{ margin: "0.4rem 0" }}><strong>Recommended Action:</strong> <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{selectedInboxLeadDetails.qualification.recommendedAction}</span></p>
                  <p style={{ margin: "0.4rem 0", lineHeight: "1.4" }}><strong>Qualification Reason:</strong> {selectedInboxLeadDetails.qualification.qualificationReason}</p>
                </div>

                {/* Profile & Overlap Details */}
                <div className="glass-card" style={{ padding: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                    👤 Scraped Profile & Overlap
                  </h3>
                  {selectedInboxLeadDetails.lead ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
                      <p style={{ margin: 0 }}><strong>Bio:</strong> {selectedInboxLeadDetails.lead.bio || "No bio scraped"}</p>
                      <div style={{ display: "flex", gap: "1.5rem", margin: "0.2rem 0" }}>
                        <span>👥 Followers: <strong>{selectedInboxLeadDetails.lead.followerCount?.toLocaleString() || 0}</strong></span>
                        <span>👤 Following: <strong>{selectedInboxLeadDetails.lead.followingCount?.toLocaleString() || 0}</strong></span>
                      </div>
                      {selectedInboxLeadDetails.matchedFollowings && selectedInboxLeadDetails.matchedFollowings.length > 0 ? (
                        <div style={{ marginTop: "0.5rem" }}>
                          <strong style={{ display: "block", marginBottom: "0.25rem", color: "#22c55e" }}>
                            🎯 Following Overlap ({selectedInboxLeadDetails.matchedFollowings.length} matched seeds):
                          </strong>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {selectedInboxLeadDetails.matchedFollowings.map((handle: string) => (
                              <span key={handle} style={{
                                fontSize: "0.75rem",
                                background: "rgba(34, 197, 94, 0.15)",
                                border: "1px solid rgba(34, 197, 94, 0.3)",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                color: "#22c55e",
                                fontWeight: "500"
                              }}>
                                @{handle}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: "0.5rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                          🚫 No following overlap found with active seed influencers.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                      No full profile details scraped yet.
                    </p>
                  )}
                </div>

                {/* User Intelligence Aggregation Snapshot */}
                {selectedInboxLeadDetails.userIntelligence && (
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      👤 User Intelligence Snapshot
                    </h3>
                    <p style={{ margin: "0.4rem 0" }}><strong>Dominant Category:</strong> {selectedInboxLeadDetails.userIntelligence.overallCategory}</p>
                    <p style={{ margin: "0.4rem 0" }}><strong>Dominant Intent:</strong> {intentDisplayNames[selectedInboxLeadDetails.userIntelligence.overallIntent] || selectedInboxLeadDetails.userIntelligence.overallIntent}</p>
                    <p style={{ margin: "0.4rem 0", lineHeight: "1.4" }}><strong>AI Summary:</strong> {selectedInboxLeadDetails.userIntelligence.summary}</p>
                    <p style={{ margin: "0.4rem 0" }}><strong>Analyzed Posts:</strong> {selectedInboxLeadDetails.userIntelligence.postCountAnalyzed} posts ({selectedInboxLeadDetails.userIntelligence.leadPostCount} leads)</p>
                  </div>
                )}

                {/* Supporting Posts */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 style={{ fontSize: "1.1rem", color: "#fff", margin: 0 }}>📚 Supporting Posts</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "250px", overflowY: "auto" }}>
                    {selectedInboxLeadDetails.supportingPosts.length === 0 ? (
                      <p style={{ color: "var(--color-text-dim)", fontSize: "0.9rem" }}>No supporting posts found.</p>
                    ) : (
                      selectedInboxLeadDetails.supportingPosts.map((post: any) => (
                        <div key={post._id} className="glass-card" style={{ padding: "0.75rem 1rem", background: "rgba(255,255,255,0.01)", border: "var(--glass-border)" }}>
                          <p style={{ fontSize: "0.85rem", color: "#eee", margin: "0 0 0.5rem 0", lineHeight: "1.4" }}>
                            {post.caption}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                            <span>Posted: {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : "Unknown"}</span>
                            <a href={post.postUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                              View Post ↗
                            </a>
                          </div>
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

      {/* CRM Lead Detail Modal */}
      {selectedCrmUsername && (
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
          onClick={() => setSelectedCrmUsername(null)}
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
              onClick={() => setSelectedCrmUsername(null)}
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

            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
              💼 CRM Lead Profile: @{selectedCrmUsername}
            </h2>

            {selectedCrmLoading && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
                <p style={{ color: "var(--color-text-dim)" }}>Loading lead profile...</p>
              </div>
            )}

            {selectedCrmError && <div className="toast toast-error">{selectedCrmError}</div>}

            {selectedCrmDetails && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>

                {/* Left Side: Profile Details & Updates */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Summary & Metrics */}
                  <div className="glass-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.02)" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      📊 Lead Metrics
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.9rem" }}>
                      <div>🔥 Lead Score: <strong>{selectedCrmDetails.qualification?.leadScore || 0}</strong></div>
                      <div>🎯 Intent Score: <strong>{selectedCrmDetails.qualification?.buyingIntent || 0}%</strong></div>
                      <div style={{ gridColumn: "span 2" }}>💡 Problem: <strong>{selectedCrmDetails.qualification?.problem || "Unknown"}</strong></div>
                      <div style={{ gridColumn: "span 2" }}>🛠️ Need: <strong>{selectedCrmDetails.qualification?.serviceNeeded || "Unknown"}</strong></div>
                    </div>
                  </div>

                  {/* Profile & Overlap Details */}
                  <div className="glass-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.02)" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      👤 Scraped Profile & Overlap
                    </h3>
                    {selectedCrmDetails.lead ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
                        <p style={{ margin: 0 }}><strong>Bio:</strong> {selectedCrmDetails.lead.bio || "No bio scraped"}</p>
                        <div style={{ display: "flex", gap: "1.5rem", margin: "0.2rem 0" }}>
                          <span>👥 Followers: <strong>{selectedCrmDetails.lead.followerCount?.toLocaleString() || 0}</strong></span>
                          <span>👤 Following: <strong>{selectedCrmDetails.lead.followingCount?.toLocaleString() || 0}</strong></span>
                        </div>
                        {selectedCrmDetails.matchedFollowings && selectedCrmDetails.matchedFollowings.length > 0 ? (
                          <div style={{ marginTop: "0.5rem" }}>
                            <strong style={{ display: "block", marginBottom: "0.25rem", color: "#22c55e" }}>
                              🎯 Following Overlap ({selectedCrmDetails.matchedFollowings.length} matched seeds):
                            </strong>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                              {selectedCrmDetails.matchedFollowings.map((handle: string) => (
                                <span key={handle} style={{
                                  fontSize: "0.75rem",
                                  background: "rgba(34, 197, 94, 0.15)",
                                  border: "1px solid rgba(34, 197, 94, 0.3)",
                                  padding: "0.15rem 0.4rem",
                                  borderRadius: "4px",
                                  color: "#22c55e",
                                  fontWeight: "500"
                                }}>
                                  @{handle}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p style={{ margin: "0.5rem 0 0 0", color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                            🚫 No following overlap found with active seed influencers.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                        No full profile details scraped yet.
                      </p>
                    )}
                  </div>

                  {/* Actions & Ownership Updates */}
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      ⚙️ Manage Lead
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem", fontWeight: "bold" }}>
                          Status Stage
                        </label>
                        <select
                          value={selectedCrmDetails.pipeline?.status || "new"}
                          onChange={(e) => handleUpdateCrmStatus(selectedCrmUsername, e.target.value)}
                          className="input-field"
                          style={{ width: "100%", margin: 0 }}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="interested">Interested</option>
                          <option value="qualified">Qualified</option>
                          <option value="converted">Converted</option>
                          <option value="lost">Lost</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--color-text-dim)", marginBottom: "0.25rem", fontWeight: "bold" }}>
                          Assignee
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="text"
                            placeholder="Unassigned"
                            defaultValue={selectedCrmDetails.pipeline?.assignedTo || ""}
                            onBlur={(e) => handleAssignCrmLead(selectedCrmUsername, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleAssignCrmLead(selectedCrmUsername, (e.target as HTMLInputElement).value);
                              }
                            }}
                            className="input-field"
                            style={{ width: "100%", margin: 0 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Tags */}
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      🏷️ Tags
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      {(selectedCrmDetails.pipeline?.tags || []).map((tag: string, idx: number) => (
                        <span key={idx} style={{
                          fontSize: "0.75rem",
                          background: "rgba(255,255,255,0.08)",
                          border: "var(--glass-border)",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          color: "#fff"
                        }}>
                          {tag}
                        </span>
                      ))}
                      {(!selectedCrmDetails.pipeline?.tags || selectedCrmDetails.pipeline.tags.length === 0) && (
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>No tags added yet.</span>
                      )}
                    </div>
                    <form onSubmit={(e) => handleAddCrmTag(e, selectedCrmUsername)} style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        placeholder="Add tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        className="input-field"
                        style={{ width: "100%", margin: 0, padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                      />
                      <button type="submit" className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", minWidth: "auto", margin: 0 }}>
                        Add
                      </button>
                    </form>
                  </div>

                </div>

                {/* Right Side: Timeline, Internal Notes & Log Feed */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Internal Notes */}
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      📝 Internal Notes
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", marginBottom: "0.75rem", paddingRight: "0.25rem" }}>
                      {(selectedCrmDetails.pipeline?.notes || []).map((note: any, idx: number) => (
                        <div key={idx} style={{
                          background: "rgba(255,255,255,0.02)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.04)"
                        }}>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#eee", whiteSpace: "pre-wrap" }}>{note.content}</p>
                          <div style={{ fontSize: "0.7rem", color: "var(--color-text-dim)", marginTop: "0.25rem", textAlign: "right" }}>
                            {new Date(note.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                      {(!selectedCrmDetails.pipeline?.notes || selectedCrmDetails.pipeline.notes.length === 0) && (
                        <div style={{ textAlign: "center", color: "var(--color-text-dim)", fontSize: "0.8rem", padding: "1rem 0" }}>No notes yet.</div>
                      )}
                    </div>
                    <form onSubmit={(e) => handleAddCrmNote(e, selectedCrmUsername)} style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        placeholder="Type a new note..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="input-field"
                        style={{ width: "100%", margin: 0, padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                      />
                      <button type="submit" className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", minWidth: "auto", margin: 0 }}>
                        Save
                      </button>
                    </form>
                  </div>

                  {/* Activity History feed */}
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <h3 style={{ fontSize: "1rem", color: "#fff", margin: "0 0 0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                      📜 Activity Log
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto", paddingRight: "0.25rem" }}>
                      {(selectedCrmDetails.activity || []).map((act: any) => {
                        const displayType = (type: string) => {
                          switch (type) {
                            case "created": return "🆕 Created";
                            case "assigned": return "👤 Assigned";
                            case "note_added": return "📝 Note Added";
                            case "status_changed": return "⚡ Stage Change";
                            case "converted": return "🎉 Converted";
                            case "lost": return "❌ Lost";
                            case "escalated": return "🔥 Escalated";
                            default: return type;
                          }
                        };
                        return (
                          <div key={act._id} style={{
                            fontSize: "0.8rem",
                            padding: "0.4rem 0.6rem",
                            background: "rgba(255,255,255,0.01)",
                            border: "1px solid rgba(255,255,255,0.04)",
                            borderRadius: "4px"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", color: "#fff", marginBottom: "0.1rem" }}>
                              <span>{displayType(act.type)}</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--color-text-dim)" }}>
                                {new Date(act.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {act.type === "status_changed" && (
                              <div style={{ color: "var(--color-text-dim)" }}>
                                <span style={{ textDecoration: "line-through" }}>{act.oldValue}</span> → <strong>{act.newValue}</strong>
                              </div>
                            )}
                            {act.type === "assigned" && (
                              <div style={{ color: "var(--color-text-dim)" }}>
                                <span style={{ textDecoration: "line-through" }}>{act.oldValue || "Unassigned"}</span> → <strong>{act.newValue || "Unassigned"}</strong>
                              </div>
                            )}
                            {act.type === "note_added" && (
                              <div style={{ color: "#eee", fontStyle: "italic" }}>
                                "{act.newValue}"
                              </div>
                            )}
                            {act.type === "escalated" && (
                              <div style={{ color: "#ff4566" }}>
                                Escalated by <strong>{act.newValue}</strong> pts! Priority escalated to high.
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(!selectedCrmDetails.activity || selectedCrmDetails.activity.length === 0) && (
                        <div style={{ textAlign: "center", color: "var(--color-text-dim)", fontSize: "0.8rem", padding: "1rem 0" }}>No actions logged.</div>
                      )}
                    </div>
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