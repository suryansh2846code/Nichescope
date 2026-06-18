# Instagram URL Collection Diagnostics & Debugging Guide

This guide details the diagnostics logging, early exit protections, and status mappings used to troubleshoot and verify Instagram post URL collection in NicheScope.

---

## 1. Diagnostics Logging Reference

### URL Discovery Diagnostics (Pre-Collection)

Before starting the scroll and collection loop, the scraper logs the locator-based counts of anchors, posts (`/p/`), and reels (`/reel/`) on the page:

```txt
[DEBUG] URL Discovery:
   anchors=145
   posts=0
   reels=24
```

### Scroll Loop Diagnostics (Per-Scroll)

After every scroll attempt inside the loop, the scraper queries the current counts of posts and reels on the page, along with the size of the unique collected URL set:

```txt
[DEBUG]
   posts=12
   reels=6
   collected=18
```

---

## 2. Scrape Protection & Exit Scenarios

### Scenario A: Empty Scroll Protection (Early Exit)

If scrolling does not load new posts (e.g., reaching the bottom of a profile or rate limiting prevents new elements from rendering), the scraper increments the `emptyScrolls` counter. If 3 consecutive scrolls yield no new unique URLs, the scraper logs an early exit warning and breaks the loop:

```txt
[EARLY EXIT]
No new URLs discovered after 3 scrolls
```

### Scenario B: No Post URLs Discovered (Preventing Junk Leads)

If the scraper completes the scroll loop with 0 unique post URLs collected, it stops the scraping process immediately and throws `NO_POST_URLS_FOUND`. 

The worker catches this exception, logs a warning, and skips saving any lead content:

```txt
[SKIPPED]
No post URLs discovered for @username
```

The worker returns the skipped job result:

```json
{
  "status": "SKIPPED",
  "reason": "NO_POST_URLS_FOUND"
}
```

---

## 3. Telemetry and Dashboard Mappings

When a job returns with `NO_POST_URLS_FOUND`, the dashboard telemetry tables and CRM tables map the reason to:

```txt
No Post URLs Found
```

This is displayed as a warning badge styled in yellow/amber (`#ffb600`) in the jobs monitor.

---

## 4. Diagnostics Analysis Matrix

| Metric Signature | Identified Root Cause | Fix Strategy |
| :--- | :--- | :--- |
| **Scenario A**:<br>posts=0<br>reels=24 | Reels are present but not standard posts. | Ensure reels support selector is active. |
| **Scenario B**:<br>posts=18<br>reels=12<br>collected=0 | Links exist on page but are not added to collection. | Audit Set insertion logic and regex mapping. |
| **Scenario C**:<br>anchors=5<br>posts=0<br>reels=0 | Grid is not loading at all. | Investigate viewport size, wait conditions, or cookies. |
