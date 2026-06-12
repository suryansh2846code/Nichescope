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

interface ScrapeProfileOptions {
  headless?: boolean;
  timeoutMs?: number;
}

const INSTAGRAM_BASE_URL = "https://www.instagram.com";

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

function parseFullNameFromTitle(title: string, username: string): string {
  const prefix = title.split(`(@${username})`)[0]?.trim();
  return prefix || username;
}

export async function scrapeProfile(
  username: string,
  options: ScrapeProfileOptions = {},
): Promise<ScrapedInstagramProfile> {
  const cleanUsername = username.replace(/^@/, "").trim();

  if (!cleanUsername) {
    throw new Error("Instagram username is required");
  }

  const profileUrl = `${INSTAGRAM_BASE_URL}/${cleanUsername}/`;
  const browser = await chromium.launch({
    headless: options.headless ?? true,
  });

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 30_000,
    });

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
      username: cleanUsername,
      fullName: parseFullNameFromTitle(metadata.title, cleanUsername),
      bio: parsedDescription.bio,
      followerCount: parsedDescription.followerCount,
      followingCount: parsedDescription.followingCount,
      postCount: parsedDescription.postCount,
      profileUrl: metadata.canonicalUrl || profileUrl,
      scrapedAt: new Date(),
      rawData: metadata,
    };
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const username = Bun.argv[2];

  if (!username) {
    console.error("Usage: bun run src/scraper/instagram.ts <instagram_username>");
    process.exit(1);
  }

  const profile = await scrapeProfile(username);
  console.log(JSON.stringify(profile, null, 2));
}
