import { chromium } from "playwright";

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

async function safeClose(resource: any, name: string, timeoutMs: number = 2000) {
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

  // Grab initial links
  const initialData = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    const hrefs = anchors.map((a: any) => a.href || "");
    const pLinks = hrefs.filter(h => h.includes('/p/'));
    const reelLinks = hrefs.filter(h => h.includes('/reel/'));
    const filtered = hrefs
      .filter((href: string) => href.includes('/p/') || href.includes('/reel/'))
      .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);

    return {
      totalAnchors: anchors.length,
      pCount: pLinks.length,
      reelCount: reelLinks.length,
      urls: filtered
    };
  });

  let postUrls = initialData.urls;

  console.log(`[DEBUG] Total anchors: ${initialData.totalAnchors}`);
  console.log(`[DEBUG] Post links found: ${initialData.pCount + initialData.reelCount}`);
  console.log(`[DEBUG] Current unique URLs: ${postUrls.length}`);

  // Scroll to load more — but only if we have time budget and need more posts
  let scrolls = 0;
  let emptyScrolls = 0;
  while (postUrls.length < maxPosts && scrolls < 5 && remaining() > 8000) {
    const previousSize = postUrls.length;
    console.log(`Scrolling profile page to load more posts... Current unique count: ${postUrls.length}, Remaining: ${Math.round(remaining() / 1000)}s`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Adaptive wait: use less time if budget is tighter
    const scrollWait = Math.min(2000, Math.max(500, remaining() - 8000));
    await page.waitForTimeout(scrollWait);

    const scrollData = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const hrefs = anchors.map((a: any) => a.href || "");
      const pLinks = hrefs.filter(h => h.includes('/p/'));
      const reelLinks = hrefs.filter(h => h.includes('/reel/'));
      const filtered = hrefs
        .filter((href: string) => href.includes('/p/') || href.includes('/reel/'));
      return {
        totalAnchors: anchors.length,
        pCount: pLinks.length,
        reelCount: reelLinks.length,
        urls: filtered
      };
    });

    console.log(`[DEBUG] Total anchors: ${scrollData.totalAnchors}`);
    console.log(`[DEBUG] Post links found: ${scrollData.pCount + scrollData.reelCount}`);

    postUrls = [...new Set([...postUrls, ...scrollData.urls])];
    console.log(`[DEBUG] Current unique URLs: ${postUrls.length}`);

    if (postUrls.length === previousSize) {
      emptyScrolls++;
    } else {
      emptyScrolls = 0;
    }

    if (emptyScrolls >= 3) {
      console.warn(`[EARLY EXIT] No new post URLs discovered after 3 scroll attempts`);
      break;
    }

    scrolls++;
  }

  const targetUrls = postUrls.slice(0, maxPosts);
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
            const postId = match ? match[1] : url;

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
    const scenario = options.testScenario;
    if (options.onStep) options.onStep(1); // Opening profile
    await new Promise(r => setTimeout(r, 1000));
    
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
        browser = await chromium.launch({ headless: options.headless ?? true });
        context = await browser.newContext({
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });
        page = await context.newPage();

        // ── STEP 1: Navigate to profile ──────────────────────────────────────
        // Navigation timeout = min(25s, remaining - 5s buffer)
        // Never let navigation eat more than 25s so we have time for posts.
        const navTimeout = Math.min(25_000, Math.max(5_000, remaining() - 5_000));
        if (options.onStep) options.onStep(1);
        console.log(`Navigating to profile: ${profileUrl} (nav timeout: ${Math.round(navTimeout / 1000)}s)`);
        await page.goto(profileUrl, { waitUntil: "networkidle", timeout: navTimeout });

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
        console.log(`Limiting scrape to latest ${MAX_POSTS_PER_PROFILE} posts`);

        // ── STEP 3–4: Scrape posts with deadline awareness ───────────────────
        const posts = await extractPosts(page, MAX_POSTS_PER_PROFILE, options.onStep, deadlineMs);

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
        if (page)    { await safeClose(page, "page", 1000); page = null; }
        if (context) { await safeClose(context, "context", 1000); context = null; }
        if (browser) { await safeClose(browser, "browser", 2000); browser = null; }
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
    if (page)    await safeClose(page, "page", 1000);
    if (context) await safeClose(context, "context", 1000);
    if (browser) await safeClose(browser, "browser", 2000);
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
  });

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    console.log(`Navigating to hashtag page: ${hashtagUrl}`);
    await page.goto(hashtagUrl, {
      waitUntil: "networkidle",
      timeout: options.timeoutMs ?? 30_000,
    });

    // Grab post links
    let postUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.href)
        .filter(href => href.includes('/p/') || href.includes('/reel/'))
        .filter((value, index, self) => self.indexOf(value) === index);
    });

    // Scroll page if we need more links
    let scrolls = 0;
    while (postUrls.length < maxPosts && scrolls < 5) {
      console.log(`Scrolling hashtag page... Current unique count: ${postUrls.length}`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const newUrls = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
          .map(a => a.href)
          .filter(href => href.includes('/p/') || href.includes('/reel/'));
      });

      postUrls = [...new Set([...postUrls, ...newUrls])];
      scrolls++;
    }

    const targetUrls = postUrls.slice(0, maxPosts);
    console.log(`Discovered ${targetUrls.length} posts for hashtag #${cleanHashtag}. Extracting authors...`);

    const discoveries: DiscoveredUser[] = [];
    const startTime = Date.now();
    const HASHTAG_TIMEOUT_MS = 60000; // 60s total limit for post extraction

    for (const url of targetUrls) {
      if (Date.now() - startTime > HASHTAG_TIMEOUT_MS) {
        console.warn(`Hashtag discovery timeout reached (${HASHTAG_TIMEOUT_MS / 1000}s). Stopping post extraction early.`);
        break;
      }

      let attempts = 0;
      let success = false;
      while (attempts < 2 && !success) {
        try {
          console.log(`Scraping post to discover author: ${url} (Attempt ${attempts + 1}/2)`);
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          await page.waitForTimeout(1000);

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
              success = true;
            } else {
              console.warn(`Could not extract username from description for post: ${url}`);
              success = true; // Don't retry parsing/extraction issues
            }
          } else {
            console.warn(`No description found for post: ${url}`);
            success = true; // Don't retry missing tag errors
          }
        } catch (err) {
          attempts++;
          console.error(`Failed to scrape post author from ${url} (Attempt ${attempts}/2):`, err instanceof Error ? err.message : String(err));
          if (attempts < 2) {
            console.log(`Retrying post scrape for author: ${url}`);
            await page.waitForTimeout(1000);
          }
        }
      }
    }

    // Deduplicate discoveries by username in the current batch
    const uniqueDiscoveriesMap = new Map<string, DiscoveredUser>();
    for (const d of discoveries) {
      uniqueDiscoveriesMap.set(d.username, d);
    }
    const uniqueDiscoveries = Array.from(uniqueDiscoveriesMap.values());

    console.log(`Completed hashtag discovery. Found ${uniqueDiscoveries.length} unique authors.`);

    return {
      hashtag: cleanHashtag,
      discoveries: uniqueDiscoveries,
    };
  } finally {
    await safeClose(browser, "browser", 2000);
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
