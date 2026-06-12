# nichescope

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

Development mode:

```bash
bun run dev
```

Required environment:

```bash
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/nichescope
REDIS_URL=redis://localhost:6379
```

Phase 2 API:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/leads \
  -H "Content-Type: application/json" \
  -d '{
    "username": "example_user",
    "fullName": "Example User",
    "bio": "Yoga teacher",
    "followerCount": 1200,
    "followingCount": 300,
    "profileUrl": "https://instagram.com/example_user",
    "foundVia": "yoga_with_adriene",
    "niche": "yoga"
  }'

curl "http://localhost:3000/leads?niche=yoga&minFollowers=1000"
```

Phase 3 scraper:

```bash
bun run scrape:profile yoga_with_adriene
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
