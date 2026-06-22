import { scrapeComments } from "../src/scraper/instagram";

const comments = await scrapeComments("https://www.instagram.com/darshanwairkar_/p/DQnyGAuEq5d");
console.log(`Total comments scraped: ${comments.length}`);
for (const c of comments) {
  console.log(`  @${c.username}: ${c.text.slice(0, 80)}`);
}
