import { chromium, type Page } from "playwright";
import fs from "fs";
import path from "path";

export interface ScrapedInstagramProfile {
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  profileUrl: string;
  scrapedAt: Date;
  rawData: {
    title: string;
    description: string;
    canonicalUrl: string;
  };
  followingHandles?: string[]; // Added for following list overlap check
}

export interface ScrapedPost {
  postId: string;
  caption: string;
  postUrl: string;
  postedAt?: Date;
  likes?: number;
  commentsCount?: number;
  hashtags: string[];
  mentions: string[];
}

export interface ScrapedInstagramResult {
  profile: ScrapedInstagramProfile;
  posts: ScrapedPost[];
}

interface ScrapeProfileOptions {
  headless?: boolean;
  timeoutMs?: number;
  maxPosts?: number;
  onStep?: (step: number) => void;
  testScenario?: string;
}

const INSTAGRAM_BASE_URL = "https://www.instagram.com";
export const MAX_POSTS_PER_PROFILE = 12;
export const PROFILE_TIMEOUT_MS = 60000;

export async function safeClose(resource: any, name: string, timeoutMs: number = 5000) {
  if (!resource) return;
  try {
    await Promise.race([
      resource.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} close timeout`)), timeoutMs))
    ]);
  } catch (err) {
    console.error(`Warning: ${name} close failed or timed out:`, err instanceof Error ? err.message : String(err));
  }
}

export async function launchStealth(options: { headless?: boolean } = {}) {
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const cookiePath = path.join(process.cwd(), "instagram_cookies.json");
  let cookies = [];
  if (fs.existsSync(cookiePath)) {
    try {
      cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      console.log(`Loaded ${cookies.length} cookies for Instagram session.`);
    } catch (e) {
      console.error("Failed to parse Instagram cookies file:", e);
    }
  }

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return { browser, context, page };
}

export function parseInstagramCount(value: string): number {
  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const match = normalized.match(/^([\d.]+)\s*([kmb])?$/);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const suffix = match[2];

  if (Number.isNaN(amount)) {
    return 0;
  }

  if (suffix === "k") {
    return Math.round(amount * 1_000);
  }

  if (suffix === "m") {
    return Math.round(amount * 1_000_000);
  }

  if (suffix === "b") {
    return Math.round(amount * 1_000_000_000);
  }

  return amount;
}

export function parseInstagramDescription(description: string) {
  const statsMatch = description.match(
    /([\d.,]+[KMBkmb]?)\s+Followers,\s+([\d.,]+[KMBkmb]?)\s+Following,\s+([\d.,]+[KMBkmb]?)\s+Posts?/,
  );
  const [, followers = "", following = "", posts = ""] = statsMatch || [];
  const bio = description.split(" - ")[1]?.trim() || "";

  return {
    bio,
    followerCount: parseInstagramCount(followers),
    followingCount: parseInstagramCount(following),
    postCount: parseInstagramCount(posts),
  };
}

export function parsePostMetaDescription(desc: string) {
  const trimmed = desc.trim();

  // Pattern 1: X likes, Y comments - User on Date: "Caption"
  const fullMatch = trimmed.match(/^([\d.,KMBkmb]+)\s+likes?,\s+([\d.,KMBkmb]+)\s+comments?\s+-\s+([a-zA-Z0-9_.-]+)\s+on\s+([^:]+):\s*"(.*)"(?:\.|\s)*$/s);
  if (fullMatch) {
    return {
      likes: parseInstagramCount(fullMatch[1] as string),
      commentsCount: parseInstagramCount(fullMatch[2] as string),
      username: fullMatch[3] as string,
      dateStr: (fullMatch[4] as string).trim(),
      caption: (fullMatch[5] as string).trim(),
    };
  }

  // Pattern 2: X likes - User on Date: "Caption"
  const likesOnlyMatch = trimmed.match(/^([\d.,KMBkmb]+)\s+likes?\s+-\s+([a-zA-Z0-9_.-]+)\s+on\s+([^:]+):\s*"(.*)"(?:\.|\s)*$/s);
  if (likesOnlyMatch) {
    return {
      likes: parseInstagramCount(likesOnlyMatch[1] as string),
      commentsCount: null,
      username: likesOnlyMatch[2] as string,
      dateStr: (likesOnlyMatch[3] as string).trim(),
      caption: (likesOnlyMatch[4] as string).trim(),
    };
  }

  // Pattern 3: Y comments - User on Date: "Caption"
  const commentsOnlyMatch = trimmed.match(/^([\d.,KMBkmb]+)\s+comments?\s+-\s+([a-zA-Z0-9_.-]+)\s+on\s+([^:]+):\s*"(.*)"(?:\.|\s)*$/s);
  if (commentsOnlyMatch) {
    return {
      likes: null,
      commentsCount: parseInstagramCount(commentsOnlyMatch[1] as string),
      username: commentsOnlyMatch[2] as string,
      dateStr: (commentsOnlyMatch[3] as string).trim(),
      caption: (commentsOnlyMatch[4] as string).trim(),
    };
  }

  // Pattern 4: User on Date: "Caption"
  const minimalMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+on\s+([^:]+):\s*"(.*)"(?:\.|\s)*$/s);
  if (minimalMatch) {
    return {
      likes: null,
      commentsCount: null,
      username: minimalMatch[1] as string,
      dateStr: (minimalMatch[2] as string).trim(),
      caption: (minimalMatch[3] as string).trim(),
    };
  }

  return null;
}

export function extractHashtags(caption: string): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[a-zA-Z0-9_\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]+/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

export function extractMentions(caption: string): string[] {
  if (!caption) return [];
  const matches = caption.match(/(?<=^|[^a-zA-Z0-9_.-])@([a-zA-Z0-9_.]+)/g);
  return matches ? matches.map(m => m.substring(1).replace(/\.+$/, "")) : [];
}

function parseFullNameFromTitle(title: string, username: string): string {
  const prefix = title.split(`(@${username})`)[0]?.trim();
  return prefix || username;
}

export async function extractProfileData(
  page: any,
  username: string
): Promise<ScrapedInstagramProfile> {
  const metadata = await page.evaluate(() => {
    const getMeta = (selector: string) =>
      document.querySelector<HTMLMetaElement>(selector)?.content || "";

    return {
      title: document.title,
      description:
        getMeta('meta[property="og:description"]') ||
        getMeta('meta[name="description"]'),
      canonicalUrl:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
        window.location.href,
    };
  });

  const parsedDescription = parseInstagramDescription(metadata.description);

  return {
    username,
    fullName: parseFullNameFromTitle(metadata.title, username),
    bio: parsedDescription.bio,
    followerCount: parsedDescription.followerCount,
    followingCount: parsedDescription.followingCount,
    postCount: parsedDescription.postCount,
    profileUrl: metadata.canonicalUrl || `${INSTAGRAM_BASE_URL}/${username}/`,
    scrapedAt: new Date(),
    rawData: metadata,
  };
}

export async function collectRecentPostUrls(
  page: Page,
  maxPosts: number = 5,
  timeoutMs: number = 60000
): Promise<string[]> {
  const deadlineMs = Date.now() + timeoutMs;
  const remaining = () => Math.max(0, deadlineMs - Date.now());

  // Wait for the post grid to actually render before extracting links.
  try {
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', {
      timeout: Math.min(10000, Math.max(3000, remaining() - 3000)),
    });
  } catch {
    console.warn("[WARN] Timed out waiting for post grid — attempting extraction anyway");
  }

  const extractPostUrls = async (): Promise<string[]> => {
    return page.evaluate((baseUrl: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const seen = new Set<string>();
      const results: string[] = [];
      for (const a of anchors) {
        const raw = a.getAttribute("href") || "";
        if (!raw.match(/\/(p|reel|reels)\//)) continue;
        const normalised = raw.replace(/^\/reels\//, "/reel/");
        const abs = `${baseUrl}${normalised}`;
        const parts = abs.split("?");
        const clean = (parts[0] || "").replace(/\/$/, "");
        if (!seen.has(clean)) {
          seen.add(clean);
          results.push(clean);
        }
      }
      return results;
    }, "https://www.instagram.com");
  };

  const initialUrls = await extractPostUrls();
  const totalAnchors = await page.locator('a').count();

  console.log(
    `[DEBUG] URL Discovery:
   anchors=${totalAnchors}
   posts=${initialUrls.filter(u => u.includes('/p/')).length}
   reels=${initialUrls.filter(u => u.includes('/reel/')).length}
   total_collected=${initialUrls.length}`
  );

  const postUrls = new Set<string>(initialUrls);

  let scrolls = 0;
  let emptyScrolls = 0;
  while (postUrls.size < maxPosts && scrolls < 5 && remaining() > 8000) {
    const previousSize = postUrls.size;
    console.log(`Scrolling profile page to load more posts... Current unique count: ${postUrls.size}, Remaining: ${Math.round(remaining() / 1000)}s`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const scrollWait = Math.min(2000, Math.max(500, remaining() - 8000));
    await page.waitForTimeout(scrollWait);

    const scrollUrls = await extractPostUrls();
    for (const url of scrollUrls) {
      postUrls.add(url);
    }

    console.log(
      `[DEBUG] After scroll ${scrolls + 1}:
   posts=${scrollUrls.filter(u => u.includes('/p/')).length}
   reels=${scrollUrls.filter(u => u.includes('/reel/')).length}
   collected=${postUrls.size}`
    );

    if (postUrls.size === previousSize) {
      emptyScrolls++;
    } else {
      emptyScrolls = 0;
    }

    if (emptyScrolls >= 3) {
      console.warn(`[EARLY EXIT] No new URLs discovered after 3 scrolls`);
      break;
    }

    scrolls++;
  }

  return Array.from(postUrls).slice(0, maxPosts);
}

export async function extractPosts(
  page: any,
  maxPosts: number = 15,
  onStep?: (step: number) => void,
  deadlineMs?: number  // absolute epoch ms — if set, all waits respect remaining budget
): Promise<ScrapedPost[]> {
  const remaining = () => deadlineMs ? Math.max(0, deadlineMs - Date.now()) : Infinity;
  const checkBudget = (minNeeded = 3000) => {
    if (deadlineMs && remaining() < minNeeded) {
      throw new Error("TIMEOUT");
    }
  };

  if (onStep) onStep(3); // Collecting post urls
  checkBudget(5000); // Need at least 5s to be worth starting post collection

  const targetUrls = await collectRecentPostUrls(page, maxPosts, remaining());

  if (targetUrls.length === 0) {
    throw new Error("NO_POST_URLS_FOUND");
  }

  console.log(`Extracting details for ${targetUrls.length} posts... Remaining budget: ${Math.round(remaining() / 1000)}s`);
  if (onStep && targetUrls.length > 0) onStep(4); // Visiting posts

  const scrapedPosts: ScrapedPost[] = [];
  for (const url of targetUrls) {
    // Stop visiting posts if budget is too low to even navigate one more
    const rem = remaining();
    if (rem < 5000) {
      console.warn(`[BUDGET] Only ${Math.round(rem / 1000)}s remaining — stopping post extraction early at ${scrapedPosts.length}/${targetUrls.length} posts`);
      break;
    }

    // Clamp per-post navigation timeout to remaining budget minus 2s buffer
    const navTimeout = Math.min(10000, Math.max(3000, rem - 2000));

    let attempts = 0;
    let success = false;
    while (attempts < 2 && !success) {
      // Check budget before each attempt
      if (remaining() < 3000) {
        console.warn(`[BUDGET] Budget exhausted mid-post-scrape — skipping remaining posts`);
        break;
      }

      try {
        console.log(`Scraping post: ${url} (Attempt ${attempts + 1}/2, timeout: ${Math.round(navTimeout / 1000)}s)`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeout });

        // Only wait 1s if we have the budget for it
        if (remaining() > 4000) {
          await page.waitForTimeout(Math.min(1000, remaining() - 3000));
        }

        const desc = await page.evaluate(() => {
          const getMeta = (selector: string) =>
            document.querySelector<HTMLMetaElement>(selector)?.content || "";
          return getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]');
        });

        if (desc) {
          const parsed = parsePostMetaDescription(desc);
          if (parsed) {
            const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
            const postId = (match && match[1]) || url;

            const hashtags = extractHashtags(parsed.caption);
            const mentions = extractMentions(parsed.caption);

            scrapedPosts.push({
              postId,
              caption: parsed.caption,
              postUrl: url,
              postedAt: parsed.dateStr ? new Date(parsed.dateStr) : undefined,
              likes: parsed.likes !== null ? parsed.likes : undefined,
              commentsCount: parsed.commentsCount !== null ? parsed.commentsCount : undefined,
              hashtags,
              mentions,
            });
            success = true;
          } else {
            console.warn(`Could not parse metadata pattern from meta description for post: ${url}`);
            success = true; // Don't retry parsing errors
          }
        } else {
          console.warn(`No meta description tag found for post: ${url}`);
          success = true; // Don't retry missing tag errors
        }
      } catch (err: any) {
        // If the error is a budget timeout, propagate it immediately
        if (err.message === "TIMEOUT") throw err;

        attempts++;
        console.error(`Failed to extract post details from ${url} (Attempt ${attempts}/2):`, err instanceof Error ? err.message : String(err));
        if (attempts < 2 && remaining() > 4000) {
          console.log(`Retrying post scrape for: ${url}`);
          await page.waitForTimeout(Math.min(1000, remaining() - 3000));
        } else {
          success = true; // Exhausted retries or no budget — move on
        }
      }
    }
  }

  return scrapedPosts;
}

export async function scrapeProfile(
  username: string,
  options: ScrapeProfileOptions = {},
): Promise<ScrapedInstagramResult> {
  const cleanUsername = username.replace(/^@/, "").trim();

  if (!cleanUsername) {
    throw new Error("Instagram username is required");
  }

  // Handle mock test scenario
  if (options.testScenario) {
    const testScenario = options.testScenario;
    const scenario = testScenario;
    if (options.onStep) options.onStep(1); // Opening profile
    await new Promise(r => setTimeout(r, 1000));

    if (testScenario === "influencer-private") {
      return {
        profile: {
          username: cleanUsername,
          fullName: "Private Profile",
          bio: "Private Account",
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          profileUrl: `${INSTAGRAM_BASE_URL}/${cleanUsername}/`,
          scrapedAt: new Date(),
          rawData: { title: "Private", description: "Private", canonicalUrl: "" }
        },
        posts: [],
        reason: "Profile is private"
      } as any;
    }

    if (testScenario === "influencer-no-posts") {
      return {
        profile: {
          username: cleanUsername,
          fullName: "No Posts",
          bio: "No Posts Account",
          followerCount: 100,
          followingCount: 100,
          postCount: 0,
          profileUrl: `${INSTAGRAM_BASE_URL}/${cleanUsername}/`,
          scrapedAt: new Date(),
          rawData: { title: "No Posts", description: "No Posts", canonicalUrl: "" }
        },
        posts: [],
        reason: "No posts found on profile"
      } as any;
    }

    if (scenario === "timeout") {
      if (options.onStep) options.onStep(3); // Loading posts
      await new Promise(r => setTimeout(r, 1000));
      throw new Error("TIMEOUT");
    }
    if (scenario === "private-account") {
      if (options.onStep) options.onStep(2); // Extracting profile
      await new Promise(r => setTimeout(r, 500));
      throw new Error("PRIVATE_ACCOUNT");
    }
    if (scenario === "large-account") {
      if (options.onStep) options.onStep(2); // Extracting profile
      await new Promise(r => setTimeout(r, 500));
      throw new Error("SKIPPED_LARGE_ACCOUNT:1248");
    }
    if (scenario === "no-post-urls-found") {
      if (options.onStep) options.onStep(2); // Extracting profile
      await new Promise(r => setTimeout(r, 500));
      if (options.onStep) options.onStep(3); // Loading posts
      await new Promise(r => setTimeout(r, 500));
      throw new Error("NO_POST_URLS_FOUND");
    }
    if (scenario === "failure") {
      if (options.onStep) options.onStep(3); // Loading posts
      await new Promise(r => setTimeout(r, 1000));
      throw new Error("Simulated transient connection failure");
    }
    if (scenario === "success") {
      if (options.onStep) options.onStep(2); // Extracting profile
      await new Promise(r => setTimeout(r, 500));
      if (options.onStep) options.onStep(3); // Loading posts
      await new Promise(r => setTimeout(r, 500));
      if (options.onStep) options.onStep(4); // Visiting posts
      await new Promise(r => setTimeout(r, 1000));
      return {
        profile: {
          username: cleanUsername,
          fullName: "Mock User",
          bio: "Mock Bio",
          followerCount: 1500,
          followingCount: 300,
          postCount: 12,
          profileUrl: `${INSTAGRAM_BASE_URL}/${cleanUsername}/`,
          scrapedAt: new Date(),
          rawData: { title: "Mock", description: "Mock", canonicalUrl: "" }
        },
        posts: [
          {
            postId: "mock-post-1",
            caption: "Trigger dev test hashtag #dev-test",
            postUrl: `${INSTAGRAM_BASE_URL}/p/mock-post-1/`,
            hashtags: ["dev-test"],
            mentions: []
          }
        ]
      };
    }
  }

  // ─── DEADLINE SETUP ───────────────────────────────────────────────────────
  // Single source of truth for the 60s budget. Every stage reads from this.
  const HARD_LIMIT_MS = PROFILE_TIMEOUT_MS;          // 60 000 ms
  const startTime = Date.now();
  const deadlineMs = startTime + HARD_LIMIT_MS;      // absolute epoch deadline

  const remaining = () => Math.max(0, deadlineMs - Date.now());
  const elapsedStr = () => `${Date.now() - startTime}ms`;

  // Hard outer timeout promise — fires at the exact deadline
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.log(`[TIMEOUT HIT] @${cleanUsername} — elapsed: ${elapsedStr()}`);
      reject(new Error("TIMEOUT"));
    }, HARD_LIMIT_MS);
  });

  console.log(`[TIMEOUT GUARD START] @${cleanUsername} — budget: ${HARD_LIMIT_MS / 1000}s`);

  // Outer-scope browser handles so finally can always clean up
  let browser: any = null;
  let context: any = null;
  let page: any = null;

  const runScrape = async (): Promise<ScrapedInstagramResult> => {
    // We allow at most 2 attempts, but only start attempt 2 if there's
    // enough budget left (≥ 10 seconds) to make it worthwhile.
    const MAX_ATTEMPTS = 2;
    const MIN_BUDGET_FOR_RETRY_MS = 10_000;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Guard: don't start a new attempt if budget is too low
      if (attempt > 1 && remaining() < MIN_BUDGET_FOR_RETRY_MS) {
        console.warn(`[BUDGET] Only ${Math.round(remaining() / 1000)}s left — skipping retry attempt for @${cleanUsername}`);
        break;
      }

      console.log(`Starting profile scrape for @${cleanUsername} (Attempt ${attempt}/${MAX_ATTEMPTS}, remaining: ${Math.round(remaining() / 1000)}s)`);

      const profileUrl = `${INSTAGRAM_BASE_URL}/${cleanUsername}/`;

      try {
        const stealthObj = await launchStealth({ headless: options.headless });
        browser = stealthObj.browser;
        context = stealthObj.context;
        page = stealthObj.page;

        // ── STEP 1: Navigate to profile ──────────────────────────────────────
        // Navigation timeout = min(25s, remaining - 5s buffer)
        // Never let navigation eat more than 25s so we have time for posts.
        const navTimeout = Math.min(25_000, Math.max(5_000, remaining() - 5_000));
        if (options.onStep) options.onStep(1);
        console.log(`Navigating to profile: ${profileUrl} (nav timeout: ${Math.round(navTimeout / 1000)}s)`);
        await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });

        // ── STEP 2: Extract profile metadata ─────────────────────────────────
        if (options.onStep) options.onStep(2);
        const isPrivate = await page.evaluate(() => {
          const bodyText = (document.body as any).innerText as string;
          return bodyText.includes("This Account is Private") || bodyText.includes("This account is private");
        });
        if (isPrivate) throw new Error("PRIVATE_ACCOUNT");

        const profile = await extractProfileData(page, cleanUsername);
        if (profile.postCount > 500) {
          throw new Error(`SKIPPED_LARGE_ACCOUNT:${profile.postCount}`);
        }

        console.log(`Found ${profile.postCount} posts. Budget remaining: ${Math.round(remaining() / 1000)}s`);
        const limit = options.maxPosts ?? MAX_POSTS_PER_PROFILE;
        console.log(`Limiting scrape to latest ${limit} posts`);

        // ── STEP 3–4: Scrape posts with deadline awareness ───────────────────
        const posts = await extractPosts(page, limit, options.onStep, deadlineMs);
        if (posts.length === 0) {
          throw new Error("NO_POST_URLS_FOUND");
        }

        // console.log(`[SCRAPE FINISHED] @${cleanUsername} — elapsed: ${elapsedStr()}, posts collected: ${posts.length}`);
        // return { profile, posts };
        
        let followingHandles: string[] = [];
        try {
          console.log(`Attempting to scrape following list for @${cleanUsername}...`);
          const followingLink = page.locator('a[href*="/following/"]');
          if (await followingLink.count() > 0) {
            await followingLink.first().click();
            await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
            for (let i = 0; i < 3; i++) {
              await page.evaluate(() => {
                const scrollable = document.querySelector('div[role="dialog"] ._aano') || 
                                   document.querySelector('div[role="dialog"] ul')?.parentElement;
                if (scrollable) {
                  scrollable.scrollTop = scrollable.scrollHeight;
                }
              });
              await page.waitForTimeout(1000);
            }
            followingHandles = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('div[role="dialog"] a[href]')) as HTMLAnchorElement[];
              const handles = new Set<string>();
              for (const a of anchors) {
                const href = a.getAttribute("href") || "";
                const match = href.match(/^\/([a-zA-Z0-9_.-]+)\/$/);
                if (match && match[1]) {
                  const handle = match[1].toLowerCase().trim();
                  if (!["explore", "reels", "direct", "stories"].includes(handle)) {
                    handles.add(handle);
                  }
                }
              }
              return Array.from(handles);
            });
            console.log(`Scraped ${followingHandles.length} following handles for @${cleanUsername}`);
          }
        } catch (err) {
          console.warn(`[WARN] Failed to scrape following list for @${cleanUsername}:`, err instanceof Error ? err.message : String(err));
        }

        profile.followingHandles = followingHandles;

        console.log(`[SCRAPE FINISHED] @${cleanUsername} — elapsed: ${elapsedStr()}, posts collected: ${posts.length}`);
        return { profile, posts };

      } catch (err: any) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Profile scrape attempt ${attempt} failed for @${cleanUsername}: ${errMsg}`);

        // Non-retryable conditions — propagate immediately
        if (
          err.message === "PRIVATE_ACCOUNT" ||
          err.message === "TIMEOUT" ||
          err.message === "NO_POST_URLS_FOUND" ||
          err.message.startsWith("SKIPPED_LARGE_ACCOUNT:")
        ) {
          throw err;
        }

        // Only retry if we have meaningful budget left
        if (attempt < MAX_ATTEMPTS && remaining() >= MIN_BUDGET_FOR_RETRY_MS) {
          // Use a shorter retry delay if budget is tight
          const retryDelay = Math.min(2000, Math.max(500, remaining() - MIN_BUDGET_FOR_RETRY_MS));
          console.log(`Retrying profile scrape for @${cleanUsername} in ${Math.round(retryDelay / 1000)}s...`);
          await new Promise(r => setTimeout(r, retryDelay));
        }
      } finally {
        // Always clean up browser resources after each attempt
        if (page) { await safeClose(page, "page", 3000); page = null; }
        if (context) { await safeClose(context, "context", 3000); context = null; }
        if (browser) { await safeClose(browser, "browser", 5000); browser = null; }
      }
    }

    throw lastError ?? new Error("Profile scrape failed after all attempts");
  };

  try {
    const result = await Promise.race([runScrape(), timeoutPromise]);
    return result;
  } finally {
    // Cancel hard timeout timer
    clearTimeout(timeoutId!);
    // Final safety net: close any lingering browser resources
    if (page) await safeClose(page, "page", 3000);
    if (context) await safeClose(context, "context", 3000);
    if (browser) await safeClose(browser, "browser", 5000);
    console.log(`[GUARD CLEARED] @${cleanUsername} — total elapsed: ${elapsedStr()}`);
  }
}


export interface DiscoveredUser {
  username: string;
  sourcePostUrl: string;
}

export interface ScrapedHashtagResult {
  hashtag: string;
  discoveries: DiscoveredUser[];
}

export async function scrapeHashtag(
  hashtag: string,
  options: { headless?: boolean; timeoutMs?: number; maxPosts?: number } = {}
): Promise<ScrapedHashtagResult> {
  const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();

  if (!cleanHashtag) {
    throw new Error("Hashtag is required");
  }

  const hashtagUrl = `${INSTAGRAM_BASE_URL}/explore/tags/${cleanHashtag}/`;
  const maxPosts = Math.min(options.maxPosts ?? 50, 50);

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    console.log(`Navigating to hashtag page: ${hashtagUrl}`);
    await page.goto(hashtagUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 30_000,
    });

    // Debug: log sample hrefs and page title to diagnose login walls
    const sampleHrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href') || '')
        .filter(h => h.length > 1)
        .slice(0, 15)
    );
    console.log('[HASHTAG DEBUG] Page title:', await page.title());
    console.log('[HASHTAG DEBUG] Sample hrefs:', JSON.stringify(sampleHrefs.slice(0, 10)));

    // Helper to extract & normalise post/reel URLs from current DOM
    const extractHashtagPostUrls = async (): Promise<string[]> => {
      return page.evaluate((baseUrl: string) => {
        const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
        const seen = new Set<string>();
        const results: string[] = [];
        for (const a of anchors) {
          const raw = a.getAttribute("href") || "";
          if (!raw.match(/\/(p|reel|reels)\//)) continue;
          const normalised = raw.replace(/^\/reels\//, "/reel/");
          const abs = `${baseUrl}${normalised}`;
          const parts = abs.split("?");
          const clean = (parts[0] || "").replace(/\/$/, "");
          if (!seen.has(clean)) { seen.add(clean); results.push(clean); }
        }
        return results;
      }, "https://www.instagram.com");
    };

    // Grab post links
    let postUrls = await extractHashtagPostUrls();

    // Scroll page if we need more links
    let scrolls = 0;
    while (postUrls.length < maxPosts && scrolls < 5) {
      console.log(`Scrolling hashtag page... Current unique count: ${postUrls.length}`);
      console.log("[DISCOVERY] Starting scroll iteration");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      console.log("[DISCOVERY] Scroll finished");

      const newUrls = await extractHashtagPostUrls();
      postUrls = [...new Set([...postUrls, ...newUrls])];
      scrolls++;
    }
    console.log("[DISCOVERY] Exited scroll loop");

    const targetUrls = postUrls.slice(0, maxPosts);
    console.log(`Discovered ${targetUrls.length} posts for hashtag #${cleanHashtag}. Extracting authors...`);

    const discoveries: DiscoveredUser[] = [];
    const startTime = Date.now();
    const HASHTAG_TIMEOUT_MS = 60000; // 60s total limit for post extraction
    const PER_URL_TIMEOUT_MS = 8000;  // max 8s per individual post — prevents hanging reels

    for (const url of targetUrls) {
      if (Date.now() - startTime > HASHTAG_TIMEOUT_MS) {
        console.warn(`Hashtag discovery timeout reached (${HASHTAG_TIMEOUT_MS / 1000}s). Stopping post extraction early.`);
        break;
      }

      const urlStart = Date.now();
      let success = false;

      // Wrap the whole per-URL attempt in a hard timeout so a single hanging
      // reel page (network stall, renderer crash, etc.) can never block the loop.
      try {
        await Promise.race([
          (async () => {
            let attempts = 0;
            while (attempts < 2 && !success) {
              try {
                console.log(`[AUTHOR START] ${url} (Attempt ${attempts + 1}/2)`);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 7000 });

                const desc = await page.evaluate(() => {
                  const getMeta = (selector: string) =>
                    document.querySelector<HTMLMetaElement>(selector)?.content || "";
                  return getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]');
                });

                if (desc) {
                  const parsed = parsePostMetaDescription(desc);
                  if (parsed && parsed.username) {
                    discoveries.push({
                      username: parsed.username.toLowerCase(),
                      sourcePostUrl: url,
                    });
                  } else {
                    console.warn(`Could not extract username from description for post: ${url}`);
                  }
                } else {
                  console.warn(`No description found for post: ${url}`);
                }
                success = true; // Either way, don't retry non-network failures
              } catch (err) {
                attempts++;
                console.error(`Failed to scrape post author from ${url} (Attempt ${attempts}/2):`, err instanceof Error ? err.message : String(err));
                if (attempts < 2) {
                  await page.waitForTimeout(500);
                }
              }
            }
          })(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`Per-URL timeout after ${PER_URL_TIMEOUT_MS}ms`)), PER_URL_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        console.warn(`[AUTHOR SKIP] ${url} — ${err instanceof Error ? err.message : String(err)}`);
        // Stop current navigation to unblock the page for the next URL
        try { await page.evaluate(() => window.stop()); } catch { /* ignore */ }
      }

      console.log(`[AUTHOR DONE] ${url} (${Date.now() - urlStart}ms)`);
    }

    // Deduplicate discoveries by username in the current batch
    console.log("[DISCOVERY] Extracting usernames");
    const uniqueDiscoveriesMap = new Map<string, DiscoveredUser>();
    for (const d of discoveries) {
      uniqueDiscoveriesMap.set(d.username, d);
    }
    const uniqueDiscoveries = Array.from(uniqueDiscoveriesMap.values());
    const usernames = new Set(discoveries.map(d => d.username));
    console.log(`[DISCOVERY] Usernames extracted: ${usernames.size}`);
    console.log(`Completed hashtag discovery. Found ${uniqueDiscoveries.length} unique authors.`);
    return {
      hashtag: cleanHashtag,
      discoveries: uniqueDiscoveries,
    };
  } finally {
    await safeClose(browser, "browser", 2000);
  }
}

export async function scrapeComments(
  postUrl: string,
  options: { headless?: boolean; timeoutMs?: number } = {}
): Promise<{ username: string; text: string }[]> {
  // If running in test mode, return mock comments
  if (process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun.env.NODE_ENV === "test")) {
    return [
      { username: "test_commenter_1", text: "I need a recommendation for a dermatologist in New York!" },
      { username: "test_commenter_2", text: "Nice post!" },
      { username: "test_commenter_3", text: "Is there any gym recommendation for real estate brokers?" },
    ];
  }

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const cookiePath = path.join(process.cwd(), "instagram_cookies.json");
    let cookies = [];
    if (fs.existsSync(cookiePath)) {
      try {
        cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      } catch (e) {
        console.error("Failed to parse Instagram cookies file:", e);
      }
    }

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    console.log(`Navigating to post page to scrape comments: ${postUrl}`);
    await page.goto(postUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 30_000,
    });

    // Wait for the page to render enough for comments
    await page.waitForTimeout(3000);

    // Scroll to load a few more comments
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
    }

    // Noise texts that appear as UI controls or footers — not real comment text
    const NOISE_TEXTS = [
      "•follow", "follow", "•unfollow", "unfollow",
      "edited", "like", "reply", "likereply",
      "see translation", "view replies", "hide replies",
      "see more posts", "carousel", "meta", "instagram",
      "view all comments", "load more comments",
      "more options", "clip", "video", "audio",
      "share", "save", "report", "block", "not interested",
      "turn on post notifications", "go to post", "copy link",
    ];

    // Extract comments by traversing from username anchor links.
    // Instagram's modern DOM (2025) no longer renders comments inside <ul><li> elements.
    // Instead each comment block has an anchor pointing to '/username/' from which
    // we can discover the commenter, then look for sibling spans containing the text.
    const comments = await page.evaluate((noiseTexts: string[]) => {
      const noiseSet = new Set(noiseTexts);
      const results: { username: string; text: string }[] = [];
      const seen = new Set<string>();

      const SYSTEM_PATHS = new Set([
        "explore", "reels", "direct", "stories", "emails",
        "developer", "about", "blog", "jobs", "help", "api",
        "privacy", "terms", "locations", "instagram", "popular",
      ]);

      const anchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9_.-]+)\/$/); 
        if (!match) continue;

        const username = (match[1] || "").toLowerCase().trim();
        if (SYSTEM_PATHS.has(username)) continue;

        // Traverse parent elements to find a sibling span with comment text
        let parent = (a as HTMLElement).parentElement;
        let commentText = '';
        let found = false;

        for (let depth = 0; depth < 6 && parent; depth++) {
          const candidates = Array.from(parent.querySelectorAll('span, div'));
          for (const cand of candidates) {
            if (cand.contains(a)) continue;   // skip ancestors of anchor
            if (cand.querySelector('a')) continue;  // skip containers with other links

            const text = (cand.textContent || '').trim();
            if (!text || text.length < 2) continue;
            if (noiseSet.has(text.toLowerCase())) continue;
            if (/^\d+[smhdw]$/.test(text)) continue; // skip timestamps
            if (text.toLowerCase() === username) continue;
            // Skip bare username-like strings (reply-to mentions shown in thread context)
            if (/^[a-zA-Z0-9_.-]+$/.test(text) && text.length <= 30 && !text.includes(' ')) continue;

            commentText = text;
            found = true;
            break;
          }
          if (found) break;
          parent = parent.parentElement;
        }

        if (found && commentText) {
          const key = `${username}:${commentText}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ username, text: commentText });
          }
        }
      }
      return results;
    }, NOISE_TEXTS);

    console.log(`Successfully scraped ${comments.length} comments from ${postUrl}`);
    return comments;
  } finally {
    await safeClose(browser, "browser", 2000);
  }
}

/**
 * Extracts the list of accounts a user follows.
 * Visits /username/following/ and scrapes the list of followed handles.
 * Returns empty array if:
 * - Account is private
 * - Profile doesn't exist
 * - Page fails to load
 * - User has no followings visible
 */
export async function extractFollowing(
  username: string,
  options: { headless?: boolean; timeoutMs?: number } = {}
): Promise<string[]> {
  // In test mode, return mock followings
  if (process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun.env.NODE_ENV === "test")) {
    return [
      "nike", "lululemon", "peloton", "fitbit",
      "applehealth", "strava", "myfitnesspal"
    ];
  }

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const followingUrl = `https://www.instagram.com/${username}/following/`;
    console.log(`Navigating to following list: ${followingUrl}`);

    try {
      await page.goto(followingUrl, {
        waitUntil: "domcontentloaded",
        timeout: options.timeoutMs ?? 30_000,
      });
    } catch (err) {
      console.warn(`Failed to load following page for @${username}:`, err instanceof Error ? err.message : String(err));
      return [];
    }

    // Wait for modal/content to render
    await page.waitForTimeout(2000);

    // Scroll modal if it exists to load more follows
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]') ||
                      document.querySelector('div[role="dialog"] ._aano') || 
                      document.querySelector('div[role="dialog"] ul')?.parentElement;
        if (modal) {
          modal.scrollTop = modal.scrollHeight;
        }
      });
      await page.waitForTimeout(1000);
    }

    // Extract usernames from follow links
    const followings = await page.evaluate(() => {
      const handles: string[] = [];
      const seen = new Set<string>();

      // Look for links to profiles in the following modal/page
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      for (const link of links) {
        const href = (link as HTMLAnchorElement).getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9_.-]+)\/?$/);
        
        if (!match) continue;
        
        const handle = (match[1] || "").toLowerCase().trim();
        
        // Skip system/meta accounts
        if (["instagram", "explore", "direct", "stories"].includes(handle)) continue;
        
        // Skip duplicates
        if (seen.has(handle)) continue;
        
        seen.add(handle);
        handles.push(handle);
      }

      return handles;
    });

    console.log(`Extracted ${followings.length} followed accounts for @${username}`);
    return followings;

  } catch (err) {
    console.error(`Error extracting following for @${username}:`, err);
    return [];
  } finally {
    await browser.close();
  }
}


if (import.meta.main) {
  const arg = Bun.argv[2];

  if (!arg) {
    console.error("Usage: bun run src/scraper/instagram.ts <instagram_username_or_hashtag>");
    process.exit(1);
  }

  if (arg.startsWith("#")) {
    const result = await scrapeHashtag(arg);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const result = await scrapeProfile(arg);
    console.log(JSON.stringify(result, null, 2));
  }
}