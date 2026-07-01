# NicheScope — Architecture Deep Dive

This document explains every moving part of NicheScope: why it exists, how it works, and the bugs that were found and fixed during development.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Pipeline](#2-data-pipeline)
3. [Queue System](#3-queue-system)
4. [Scraper Design](#4-scraper-design)
5. [AI Layer](#5-ai-layer)
6. [Real-time Event System](#6-real-time-event-system)
7. [Database Schema](#7-database-schema)
8. [Session Lifecycle](#8-session-lifecycle)
9. [Bugs Fixed & Lessons Learned](#9-bugs-fixed--lessons-learned)

---

## 1. System Overview

```
Browser (React UI)
    |  WebSocket (ws://localhost:3002)
    |  HTTP (http://localhost:3001)
    |
    +---> Express API Server (src/index.ts)
    |         |
    |         +---> MongoDB (lead data, sessions, settings)
    |         +---> Redis (BullMQ job queues + Pub/Sub)
    |
    +---> Bun Frontend Server (src/frontend/server.ts :5173)

Background Workers (all run in the same process via run-all.ts)
    influencerDiscoveryWorker  ─ Playwright → post URLs
    commentScrapeWorker        ─ Playwright → comment text
    commentAnalysisWorker      ─ LLM → lead classification
    scrapeWorker               ─ Playwright → profile enrichment
    leadQualificationWorker    ─ LLM → deep lead scoring
    aiAnalysisWorker           ─ LLM → post-level analysis
    userIntelligenceWorker     ─ aggregates signals per user
    embeddingWorker            ─ vector embeddings for search
    monitoringWorker           ─ re-scans existing leads
```

---

## 2. Data Pipeline

### Full flow, step by step

```
User clicks "Start Scan" in the UI
        │
        ▼
POST /api/discover/run-niche-scan
  - Creates a DiscoverySession document in MongoDB (status: "running")
  - Upserts each influencer into the SeedInfluencer collection
  - Enqueues one influencer-discovery job per influencer
        │
        ▼
[STAGE 1] influencerDiscoveryWorker
  - Launches Playwright (stealth Chromium + Instagram cookies)
  - Navigates to instagram.com/<username>
  - Waits for the post grid to load
  - Collects anchor tags matching /\/(p|reel|reels)\/[A-Za-z0-9_-]+/
    (regex requires a post ID — prevents collecting bare nav links like /reel/)
  - Takes the 5 most recent posts
  - Emits "posts_found" event (written to DB + Redis Pub/Sub → WebSocket → UI)
  - Enqueues one comment-scrape job per post
    Job ID: comments-<postId>-<sessionId>  ← session-scoped to prevent dedup
        │
        ▼
[STAGE 2] commentScrapeWorker
  - LEAD GATE: if session already has >= minLeadsRequired leads, skips post
    (avoids wasting time once enough leads are found)
  - Launches Playwright, opens post URL
  - Runs a timer loop for up to commentScrapeTimeoutMs (default: 120s):
      ┌─────────────────────────────────────────────┐
      │  Every round:                               │
      │  1. extractVisibleComments() — reads all    │
      │     visible comment <span> elements,        │
      │     deduplicates by author+text             │
      │  2. If 3 consecutive empty rounds → stop    │
      │     (page exhausted, no more to load)       │
      │  3. Try clicking "Load more comments"       │
      │  4. If no button, scroll to bottom          │
      └─────────────────────────────────────────────┘
  - Emits "comments_extracted" event with count
  - Enqueues one comment-analysis job per new comment
    Job ID: analyze-<username>-<postId>-<random>
        │
        ▼
[STAGE 3] commentAnalysisWorker
  - Calls getAIProvider().analyzeCaption(commentText)
  - Saves CommentAnalysis document:
      { username, commentText, postUrl, isLead, category, intent,
        confidence, sentiment, sessionId }
  - Emits "comment_analyzed" (or "comment_error" on failure)
  - If isLead = true:
      1. Check if Lead already exists for this username (skip duplicate)
      2. Create Lead immediately with placeholder data:
         { username, profileUrl, niche, foundVia: "comment-analysis",
           rawData: { commentText, category, intent } }
         ← CRITICAL: this happens before the scrape, so leads are never
           lost if the scrape times out
      3. Emit "lead_created" event → UI lead counter increments
      4. Enqueue profile enrichment job in scrape queue
        │
        ▼
[STAGE 4] scrapeWorker  (enrichment only — lead already saved)
  - Launches Playwright, opens commenter's profile
  - Extracts: bio, followerCount, followingCount, fullName
  - Updates the existing Lead record with real data
  - Scrapes following list → analyzeFollowingList() checks overlap
    with known seed influencers → adds followingBoost score
  - Enqueues user intelligence aggregation job
```

### Auto-completion logic

The session auto-completes when:

```
postsScraped >= postsFound
AND
(commentsAnalyzed + commentsFailed) >= commentsExtracted
AND
postsFound > 0
```

This runs inside `discoveryEventEmitter.emit()` after every event, so completion is detected the moment the last job finishes — no polling needed.

---

## 3. Queue System

### Queue names and their purpose

| Queue Name | Producer | Consumer | Job Purpose |
|---|---|---|---|
| `influencer-discovery` | `discover.ts` route | `influencerDiscoveryWorker` | Scrape post URLs from an influencer |
| `comment-scrape` | `influencerDiscoveryWorker` | `commentScrapeWorker` | Scrape comments from one post |
| `comment-analysis` | `commentScrapeWorker` | `commentAnalysisWorker` | AI-classify one comment |
| `scrape` | `commentAnalysisWorker` | `scrapeWorker` | Enrich lead with profile data |
| `analysis` | various | `aiAnalysisWorker` | Post-level AI analysis |
| `lead-qualification` | various | `leadQualificationWorker` | Deep lead scoring |
| `user-intelligence` | `scrapeWorker` | `userIntelligenceWorker` | Aggregate all signals for a user |
| `embedding` | various | `embeddingWorker` | Compute vector embeddings |
| `monitoring` | scheduler | `monitoringWorker` | Re-scan existing leads for changes |

### Concurrency settings

| Worker | Concurrency | Reason |
|---|---|---|
| `influencerDiscoveryWorker` | 3 | Playwright is memory-heavy; 3 browsers at once is stable |
| `commentScrapeWorker` | 2 | Heavy Playwright jobs, long-running (up to 120s) |
| `commentAnalysisWorker` | 4 | Fast API calls, mostly network I/O |
| `scrapeWorker` | 5 | Mix of Playwright + DB writes |

### Job ID design

Job IDs serve as deduplication keys — BullMQ will not enqueue a second job if one with the same ID is waiting, active, or completed (within the retention window).

```
influencer-discovery:  run-<username>-<timestamp>
comment-scrape:        comments-<postId>-<sessionId>   ← sessionId prevents cross-scan dedup
comment-analysis:      analyze-<username>-<postId>-<random>
scrape (enrichment):   scrape-<username>-<timestamp>
```

The comment-scrape ID includes `sessionId` so that re-scanning the same posts in a new session creates fresh jobs. Without this, BullMQ would silently drop re-scans because completed jobs are retained for 24 hours.

---

## 4. Scraper Design

All scraping is in `src/scraper/instagram.ts`.

### Authentication

Instagram requires login to see comments. The scraper loads cookies from `instagram_cookies.json` and injects them into the Playwright browser context before navigation. This avoids logging in on every run and is much harder to detect than a fresh login each time.

Generate cookies by running `save-cookies.ts` once from a terminal with a display:

```bash
bun run save-cookies.ts
```

### Stealth mode

`launchStealth()` launches Chromium with:
- `headless: true` (no window) but with standard desktop user agent
- Arguments that suppress automation flags (`--disable-blink-features=AutomationControlled`)
- Viewport set to a common desktop resolution

### Post URL collection

```typescript
// Regex requires a post ID segment — prevents bare nav links (/reel/) from matching
if (!raw.match(/\/(p|reel|reels)\/[A-Za-z0-9_-]+/)) continue;
```

This was a critical bug fix. Instagram's nav bar contains `<a href="/reel/">` links with no post ID. Without the `[A-Za-z0-9_-]+` requirement, these were collected as post URLs. `getPostId()` then returned the full URL as the post ID, and BullMQ rejected the job because colons (`:`) are reserved in its job ID format.

### Comment scraping timer loop

```
deadline = Date.now() + commentScrapeTimeoutMs (default 120s)
emptyRounds = 0
seen = Set<string>  // deduplication

while (Date.now() < deadline - 4000):
    batch = extractVisibleComments(page, seen)
    if batch.length > 0:
        allComments.push(...batch)
        emptyRounds = 0
    else:
        emptyRounds++
        if emptyRounds >= 3: break  // page exhausted

    // Try "Load more comments" button first
    if loadMoreButton exists:
        click(loadMoreButton)
        wait 1.5s
    else:
        scroll to bottom
        wait 1.5s
```

This replaces the original 2-scroll loop, which only collected the first ~20 comments. The timer-based approach can collect hundreds of comments and stops early if the page is exhausted.

---

## 5. AI Layer

### Provider interface

```typescript
interface AIProvider {
  analyzeCaption(caption: string): Promise<AnalysisResult>;
  generateUserSummary(captions: string[]): Promise<string>;
  qualifyLead(username, summary, category, intent, leadScore, captions): Promise<LeadQualificationResult>;
}
```

### Factory function

`getAIProvider()` in `src/services/ai/AIProvider.ts` reads `AI_PROVIDER` from the environment and returns the appropriate provider:

```typescript
if (provider === "groq" && groqKey)
  return new OpenAIProvider(groqKey, "https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant");
if (provider === "gemini" && geminiKey)
  return new GeminiProvider(geminiKey, "gemini-2.5-flash");
if (provider === "openai" && openaiKey)
  return new OpenAIProvider(openaiKey, "https://api.openai.com/v1/chat/completions", "gpt-4o-mini");
if (provider === "openrouter" && openrouterKey)
  return new OpenAIProvider(openrouterKey, "https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3-8b-instruct");
```

`OpenAIProvider` covers Groq, OpenAI, and OpenRouter because they all implement the same OpenAI chat completions API spec. Only the base URL and model name differ.

### What the AI classifies

Each comment is sent to the LLM with a prompt asking it to determine buying intent. The response includes:

```typescript
interface AnalysisResult {
  isLead: boolean;        // key decision: save this person or not?
  category: string;       // "fitness seeker", "product inquiry", etc.
  intent: string;         // "looking for personal trainer"
  confidence: number;     // 0–100
  keywords: string[];     // extracted signal words
  summary: string;        // one-line human-readable explanation
  sentiment: "positive" | "neutral" | "negative";
}
```

---

## 6. Real-time Event System

### Components

```
Worker process
    │
    └─> discoveryEmitter.emit(sessionId, type, data)
            │
            ├─ 1. MongoDB: findOneAndUpdate({ sessionId }, { $push: { events: ... }, $inc: stats })
            │            updates stats based on event type
            │
            └─ 2. Redis: PUBLISH discovery:<sessionId> <JSON payload>
                        │
                        └─> discoveryWebSocketServer subscribes to Redis channel
                                │
                                └─> WebSocket: sends JSON to all browser clients
                                              subscribed to this sessionId
```

### Event types

| Event | Emitted by | Stats updated |
|---|---|---|
| `posts_found` | influencerDiscoveryWorker | `stats.postsFound = N` |
| `comments_extracted` | commentScrapeWorker | `stats.postsScraped += 1`, `stats.commentsExtracted += N` |
| `comment_analyzed` | commentAnalysisWorker | `stats.commentsAnalyzed += 1` (+ `commentsQualified` if isLead) |
| `comment_error` | commentAnalysisWorker | `stats.commentsFailed += 1` |
| `lead_created` | commentAnalysisWorker | `stats.leadsCreated += 1` |
| `completed` | discoveryEventEmitter (auto) | `status = "completed"` |
| `already_scanned` | influencerDiscoveryWorker | `status = "already_scanned"` |
| `error` / `failed` | workers | `status = "failed"` |
| `paused` / `resumed` | API routes | `status = "paused"` / `"running"` |
| `cancelled` | API routes | `status = "cancelled"` |

---

## 7. Database Schema

### Lead

The central output of the system.

```typescript
{
  username: string;           // Instagram handle (lowercase, no @)
  fullName: string;           // from profile scrape (empty if scrape failed/skipped)
  bio: string;                // from profile scrape
  followerCount: number;
  followingCount: number;
  profileUrl: string;         // https://www.instagram.com/<username>/
  contactEmail?: string;
  foundVia: string;           // "comment-analysis" or "instagram-scraper"
  niche: string;
  scrapedAt: Date;
  rawData: object;            // { commentText, category, intent } for comment-sourced leads
  followingHandles: string[]; // from extractFollowing()
  followingBoost: number;     // score boost based on seed influencer overlap
  followingOverlapCount: number;
  matchedSeedInfluencers: string[];
}
```

### CommentAnalysis

One document per comment analyzed.

```typescript
{
  username: string;
  commentText: string;
  postUrl: string;
  isLead: boolean;
  category: string;
  intent: string;
  intentScore: number;        // AI confidence
  sentiment: string;
  sessionId?: string;         // which scan produced this (for lead gating)
  analyzedAt: Date;
}
```

### DiscoverySession

Tracks one scan run. One document per influencer per scan.

```typescript
{
  sessionId: string;          // "run-<username>-<timestamp>"
  username: string;
  niche: string;
  status: "running" | "paused" | "cancelled" | "completed" | "failed" | "already_scanned";
  stats: {
    postsFound: number;
    postsScraped: number;
    commentsExtracted: number;
    commentsAnalyzed: number;
    commentsFailed: number;
    commentsQualified: number;
    leadsCreated: number;
  };
  events: Array<{ type, data, timestamp }>;
  startedAt: Date;
  completedAt?: Date;
}
```

### SystemSettings

Singleton document (key = "global"). Editable from the UI Settings tab.

```typescript
{
  maxPostsScraped: number;           // default: 5
  maxCommentsScraped: number;        // default: 100
  commentScrapeTimeoutMs: number;    // default: 120000
  minLeadsRequired: number;          // default: 10 (lead gate threshold)
  followingBoostWeight: number;      // default: 30
  intentThreshold: number;           // default: 60
  immediateContactThreshold: number; // default: 85
  temperature: number;               // LLM temperature, default: 0.2
}
```

---

## 8. Session Lifecycle

```
POST /run-niche-scan
  ├── Creates DiscoverySession (status: "running")
  └── Enqueues influencer-discovery jobs

        ┌────────────────────────────────┐
        │  status: "running"             │
        │                                │
        │  User can:                     │
        │  - Pause  → status: "paused"   │
        │  - Resume → status: "running"  │
        │  - Cancel → status: "cancelled"│
        └────────────────┬───────────────┘
                         │
              Auto-completion check runs after every event:
              if postsScraped >= postsFound
                 AND (commentsAnalyzed + commentsFailed) >= commentsExtracted
                 AND postsFound > 0
                         │
                         ▼
                 status: "completed"
```

Workers check `checkDiscoverySessionState(sessionId)` at the start of every job. If the session is `cancelled`, `failed`, `completed`, or `already_scanned`, the job returns immediately without doing any work. This prevents stale jobs from running after a scan is stopped.

---

## 9. Bugs Fixed & Lessons Learned

These are the real engineering problems encountered and solved during development. Each one is worth understanding because they represent common distributed systems pitfalls.

---

### Bug 1: URL regex collected bare nav links

**Symptom**: BullMQ threw `Custom Id cannot contain ':'` errors. No comment scrape jobs were being processed.

**Root cause**: Instagram's navbar contains `<a href="/reel/">` links (no post ID). The original regex `/\/(p|reel|reels)\//` matched these. `getPostId()` returned the full URL as the post ID (e.g. `https://www.instagram.com/reel`), and BullMQ rejects job IDs containing colons.

**Fix**: Changed regex to `/\/(p|reel|reels)\/[A-Za-z0-9_-]+/` — requires a post ID after the slash.

**Lesson**: Always validate external data before using it as an identifier. A regex that's "almost right" can silently corrupt downstream systems.

---

### Bug 2: Failed AI jobs caused premature session completion

**Symptom**: Sessions completed after only a few seconds with 0 leads. All remaining jobs discarded themselves.

**Root cause**: The catch block in `commentAnalysisWorker` emitted `comment_analyzed` instead of `comment_error`. When OpenRouter returned 402 errors, each failed job was incorrectly counted as analyzed. The auto-completion check saw `commentsAnalyzed >= commentsExtracted` and marked the session complete. All subsequent jobs called `checkDiscoverySessionState()`, saw `status: "completed"`, and returned immediately.

**Fix**: The catch block now emits `comment_error`. The auto-completion check counts `commentsAnalyzed + commentsFailed` against `commentsExtracted`.

**Lesson**: Error paths must be as carefully designed as success paths. An incorrect event type in a catch block can silently corrupt the entire state machine.

---

### Bug 3: 115 leads flagged, 3 saved

**Symptom**: The AI correctly identified many leads, but almost none appeared in the Leads collection.

**Root cause**: `scrapeWorker` had a BullMQ-level timeout of 90 seconds. A full commenter profile scrape (profile page + following list + posts) regularly exceeded 90 seconds. When BullMQ kills a job at the timeout boundary, it does so at the queue level — the worker's `try/catch` block does not run. The code that created a Lead record was in the catch block, so it never executed.

**Fix**: Create the Lead document immediately when the AI classifies a comment as `isLead: true`, before the profile scrape is even enqueued. The scrape job now only enriches an already-saved record.

**Lesson**: In distributed systems, never assume your cleanup/fallback code will run. Design for the case where your process is killed externally.

---

### Bug 4: BullMQ job deduplication silently blocked re-scans

**Symptom**: After the first scan, subsequent scans showed "Posts 0/5" — no posts were ever scraped, no matter how long the scan ran.

**Root cause**: BullMQ retains completed jobs for 24 hours (configured via `removeOnComplete: { age: 86400 }`). Comment-scrape job IDs were `comments-<postId>`. When a new scan enqueued the same posts (same influencers, same recent posts), BullMQ found the job IDs already existed in the completed set and silently dropped them. No jobs were processed, no events were emitted, the session stats never changed.

**Fix**: Job IDs are now `comments-<postId>-<sessionId>`. Each scan session gets unique IDs, so BullMQ treats them as new jobs. Within a single session, the same post still deduplicates correctly.

**Lesson**: BullMQ's job deduplication is aggressive and silent. Any time you use a static identifier as a job ID, you risk having jobs silently dropped on repeat runs. Always scope IDs to the context that requires uniqueness.

---

### Bug 5: OpenRouter 402 with no error surfacing

**Symptom**: 359 comment-analysis jobs failed over multiple scan attempts. The UI showed 0 leads. No obvious error was visible.

**Root cause**: `AI_PROVIDER` was set to `openrouter`, which had no credits. The HTTP 402 response was thrown as an error inside `analyzeCaption()`. The error propagated correctly but was only visible in BullMQ's failed job list — not in any UI notification or console output that was easy to spot.

**Fix**: Switched `AI_PROVIDER=groq` with a Groq API key (free tier). Added better error logging in `commentAnalysisWorker`.

**Lesson**: External API failures need to be surfaced clearly. A 402 that silently fills a failed queue is invisible until you explicitly inspect queue state.
