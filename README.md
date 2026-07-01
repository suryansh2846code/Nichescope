# NicheScope

An automated Instagram lead discovery engine built with TypeScript, Bun, Playwright, BullMQ, and LLMs.

You give it a niche (e.g. "fitness") and a list of seed influencer accounts. It crawls their comment sections, uses AI to identify users expressing buying intent, and saves them as qualified leads — with a live dashboard that streams progress in real time over WebSocket.

---

## What It Does

1. **Discovers posts** from seed influencer accounts using Playwright (headless Chromium)
2. **Scrapes comments** from each post, scrolling for up to 2 minutes to load all comments
3. **Classifies each comment** with an LLM — is this person looking for a product or service?
4. **Saves qualified leads instantly** — the record is created the moment AI says yes
5. **Enriches leads** by scraping the commenter's Instagram profile in the background
6. **Streams everything** to a React dashboard over WebSocket in real time

---

## Architecture

```
                      POST /api/discover/run-niche-scan
                                    |
                                    v
                    +-------------------------------+
                    | STAGE 1: Influencer Discovery |
                    | influencerDiscoveryWorker     |
                    |                               |
                    | Playwright opens profile      |
                    | Collects 5 recent post URLs   |
                    +---------------+---------------+
                                    |  1 job per post
                                    v
                    +-------------------------------+
                    | STAGE 2: Comment Scraping     |
                    | commentScrapeWorker           |
                    |                               |
                    | Playwright opens post         |
                    | Scrolls + clicks Load more    |
                    | Timer loop up to 120s         |
                    +---------------+---------------+
                                    |  1 job per comment
                                    v
                    +-------------------------------+
                    | STAGE 3: AI Classification    |
                    | commentAnalysisWorker         |
                    |                               |
                    | LLM: is this a lead?          |
                    | If yes -> save Lead NOW       |
                    | Emit lead_created event       |
                    +---------------+---------------+
                                    |  1 enrichment job per lead
                                    v
                    +-------------------------------+
                    | STAGE 4: Profile Enrichment   |
                    | scrapeWorker                  |
                    |                               |
                    | Scrapes commenter profile     |
                    | Updates bio, followers, etc.  |
                    | Scores following overlap      |
                    +-------------------------------+

All stages stream events -> Redis Pub/Sub -> WebSocket -> React UI
```

For the full technical deep dive, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API Server | Express 5 |
| Frontend | React 19 (bundled by Bun) |
| Database | MongoDB via Mongoose |
| Job Queues | BullMQ |
| Queue Broker | Redis |
| Real-time | WebSocket + Redis Pub/Sub |
| Scraper | Playwright (Chromium, stealth mode) |
| AI | Groq / Gemini / OpenAI / OpenRouter (pluggable) |

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- MongoDB running on localhost:27017
- Redis running on localhost:6379
- A secondary Instagram account for scraping (do not use your personal account)

### Install

```bash
bun install
```

### Configure environment

Create a `.env` file in the project root:

```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/nichescope
REDIS_URL=redis://localhost:6379

# Choose one AI provider
AI_PROVIDER=groq

# Only the key for your chosen provider is needed
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-v1-...
```

### Generate Instagram session cookies

NicheScope scrapes Instagram while logged in. You need to generate session cookies once using a real browser:

```bash
bun run save-cookies.ts
```

Run this from a terminal on your desktop (not over SSH). A Chrome window will open. Log in to your scraper Instagram account. Cookies are saved to `instagram_cookies.json` automatically.

> Use a secondary account. Aggressive scraping can trigger Instagram bot detection.

### Start everything

```bash
bun run dev:all
```

This starts all services concurrently:
- API server at `http://localhost:3001`
- React dashboard at `http://localhost:5173`
- 9 background workers

---

## Usage

1. Open `http://localhost:5173`
2. Go to the **Seed Influencers** tab
3. Enter a niche and up to 5 Instagram usernames
4. Click **Start Scan**
5. Watch the pipeline run in real time

Qualified leads appear in **Qualified Leads**. Move them through stages in the **CRM Pipeline** tab.

---

## AI Providers

| `AI_PROVIDER` value | Model | Notes |
|---|---|---|
| `groq` | llama-3.1-8b-instant | Free tier, fast — recommended |
| `gemini` | gemini-2.5-flash | Good quality |
| `openai` | gpt-4o-mini | Best quality, paid |
| `openrouter` | meta-llama/llama-3-8b-instruct | Paid credits required |

---

## Tunable Settings

All settings live in MongoDB and are editable from the **Settings** tab in the UI:

| Setting | Default | Description |
|---|---|---|
| `maxPostsScraped` | 5 | Posts to collect per influencer |
| `maxCommentsScraped` | 100 | Max comments to extract per post |
| `commentScrapeTimeoutMs` | 120000 | Milliseconds to scroll each post for comments |
| `minLeadsRequired` | 10 | Skip remaining posts once this many leads found |
| `intentThreshold` | 60 | Min AI confidence score to classify as a lead |
| `followingBoostWeight` | 30 | Score boost if lead follows seed influencers |

---

## Scripts

```bash
bun run dev:all                    # Start all services
bun run start                      # API server only
bun run frontend                   # Frontend only
bun run worker:scrape              # Profile scrape worker only
bun run worker:influencer-discover # Influencer discovery worker only
bun run worker:comment-scrape      # Comment scrape worker only
bun run worker:comment-analyze     # Comment analysis worker only
bun test                           # Run all tests
bun run save-cookies.ts            # Generate Instagram session cookies
```

---

## Project Structure

```
src/
├── index.ts                          # Express server entry
├── db.ts                             # MongoDB connection
├── models/                           # Mongoose schemas
│   ├── Lead.ts                       # Discovered leads
│   ├── CommentAnalysis.ts            # Per-comment AI results
│   ├── DiscoverySession.ts           # Live scan state and stats
│   ├── SeedInfluencer.ts             # Influencer accounts to scan
│   ├── SystemSettings.ts             # Tunable config (singleton)
│   └── ...
├── queues/                           # BullMQ queue definitions
│   ├── commentQueues.ts              # Discovery + scrape + analysis queues
│   ├── scrapeQueue.ts                # Profile enrichment queue
│   └── redis.ts                      # Shared Redis connection factory
├── workers/                          # BullMQ worker processes
│   ├── influencerDiscoveryWorker.ts  # Stage 1: collect post URLs
│   ├── commentScrapeWorker.ts        # Stage 2: scrape comments
│   ├── commentAnalysisWorker.ts      # Stage 3: AI classification
│   ├── scrapeWorker.ts               # Stage 4: profile enrichment
│   ├── leadQualificationWorker.ts    # Deep lead scoring
│   ├── userIntelligenceWorker.ts     # Aggregate user signals
│   ├── embeddingWorker.ts            # Vector embeddings
│   └── monitoringWorker.ts           # Re-scan existing leads
├── scraper/
│   └── instagram.ts                  # All Playwright logic
├── services/
│   ├── ai/AIProvider.ts              # LLM interface + provider factory
│   ├── discovery/                    # Redis Pub/Sub + WebSocket layer
│   └── following/                    # Following list overlap scoring
└── routes/                           # Express route handlers

run-all.ts                            # Starts all services in parallel
save-cookies.ts                       # Instagram cookie generator
docs/ARCHITECTURE.md                  # Full technical architecture doc
```

---

## Known Limitations

- **Rate limiting**: Instagram throttles requests from the same IP or account. If scans consistently return 0 posts, wait a few hours before retrying.
- **Cookie expiry**: Session cookies expire after ~90 days or if Instagram detects the account. Re-run `save-cookies.ts` to refresh them.
- **Private accounts**: Private influencer profiles and commenter profiles return 0 results and are silently skipped.
- **Comment loading**: Instagram loads comments lazily. Very popular posts with thousands of comments may not load all of them within the 120-second scrape window.

---

## License

MIT
