# NicheScope Scraper Diagnostics and Log Reference

This document outlines the log signatures, early exit conditions, and diagnostic workflows for NicheScope's Instagram profile post URL scraper.

---

## 1. Post URL Collection Logs

During the post collection phase (`extractPosts` in `src/scraper/instagram.ts`), the scraper queries all `<a>` tags on the profile page and filters them to identify post and reel links. The scraper outputs detailed log statements for each page load and scroll attempt.

### Standard Log signature

For every scroll iteration, the scraper outputs:
```txt
[DEBUG] Total anchors: <count>
[DEBUG] /p/ links: <count>
[DEBUG] /reel/ links: <count>
[DEBUG] Post links found: <count>
[DEBUG] Current unique URLs: <count>
```

Where:
* **Total anchors**: Total number of `<a>` tags found on the DOM.
* **/p/ links**: Count of anchors pointing to `/p/` (standard posts).
* **/reel/ links**: Count of anchors pointing to `/reel/` or `/reels/` (reels/videos).
* **Post links found**: Sum of `/p/` and `/reel/` links extracted in the current viewport check.
* **Current unique URLs**: Total unique URLs collected and accumulated across all scroll iterations.

---

## 2. Execution Scenarios & Signatures

### Scenario A: Successful Post Discovery

When a profile is public and has posts, you will see the unique count increment as the scraper scrolls:

```txt
Found 150 posts. Budget remaining: 110s
Limiting scrape to latest 12 posts
[DEBUG] Total anchors: 45
[DEBUG] /p/ links: 12
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 12
[DEBUG] Current unique URLs: 12
Extracting details for 12 posts... Remaining budget: 108s
```

### Scenario B: Empty Scroll Early Exit

If a profile has posts but further scrolling does not load any new ones (e.g., reached the end of the profile or page content stopped rendering), the empty scroll count incrementer triggers. After **3 consecutive scrolls** yielding no new unique URLs, the scraper breaks the loop early to save time budget.

```txt
Scrolling profile page to load more posts... Current unique count: 12, Remaining: 95s
[DEBUG] Total anchors: 45
[DEBUG] /p/ links: 12
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 12
[DEBUG] Current unique URLs: 12
Scrolling profile page to load more posts... Current unique count: 12, Remaining: 92s
[DEBUG] Total anchors: 45
[DEBUG] /p/ links: 12
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 12
[DEBUG] Current unique URLs: 12
Scrolling profile page to load more posts... Current unique count: 12, Remaining: 89s
[DEBUG] Total anchors: 45
[DEBUG] /p/ links: 12
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 12
[DEBUG] Current unique URLs: 12
[EARLY EXIT] No new post URLs discovered after 3 scroll attempts
```

### Scenario C: No Posts Found Skipped Status

If the total accumulated unique URL count is 0 after completing the scroll loop, a `NO_POSTS_FOUND` error is thrown. This avoids running the scraper profile extraction with 0 posts.

```txt
Found 296 posts. Budget remaining: 105s
Limiting scrape to latest 12 posts
[DEBUG] Total anchors: 18
[DEBUG] /p/ links: 0
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 0
[DEBUG] Current unique URLs: 0
Scrolling profile page to load more posts... Current unique count: 0, Remaining: 102s
[DEBUG] Total anchors: 18
[DEBUG] /p/ links: 0
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 0
[DEBUG] Current unique URLs: 0
Scrolling profile page to load more posts... Current unique count: 0, Remaining: 99s
[DEBUG] Total anchors: 18
[DEBUG] /p/ links: 0
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 0
[DEBUG] Current unique URLs: 0
Scrolling profile page to load more posts... Current unique count: 0, Remaining: 96s
[DEBUG] Total anchors: 18
[DEBUG] /p/ links: 0
[DEBUG] /reel/ links: 0
[DEBUG] Post links found: 0
[DEBUG] Current unique URLs: 0
[EARLY EXIT] No new post URLs discovered after 3 scroll attempts
Profile scrape attempt 1 failed for @some_username: NO_POSTS_FOUND
[SKIPPED] No post URLs discovered for @some_username
```

---

## 3. Telemetry and Dashboard Representation

When `NO_POSTS_FOUND` is propagated:
1. The Scrape Worker returns:
   ```json
   {
     "status": "SKIPPED",
     "reason": "NO_POSTS_FOUND"
   }
   ```
2. The Dashboard CRM Table and Pipeline Telemetry table render the status as **No Posts Found** styled in yellow/amber (`#ffb600`) to alert operators that metadata was retrieved but post collection failed (e.g., due to updated selectors, rate limiting, or empty profile feeds).

---

## 4. Troubleshooting Selector Issues

If the logs continuously show `Post links found: 0` for profiles known to have posts, Instagram has likely updated its routing/layout:
1. Inspect if post URLs no longer contain `/p/`, `/reel/`, or `/reels/`.
2. Update the regex / inclusion checks inside `extractPosts` (`src/scraper/instagram.ts`) accordingly.
