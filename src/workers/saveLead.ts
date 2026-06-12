import { Lead } from "../models/Lead";
import type { ScrapedInstagramProfile } from "../scraper/instagram";

export async function saveOrUpdateScrapedProfile(
  niche: string,
  profile: ScrapedInstagramProfile
) {
  const existingLead = await Lead.findOne({
    username: new RegExp(`^${profile.username}$`, "i"),
  });

  if (existingLead) {
    existingLead.fullName = profile.fullName;
    existingLead.bio = profile.bio;
    existingLead.followerCount = profile.followerCount;
    existingLead.followingCount = profile.followingCount;
    existingLead.profileUrl = profile.profileUrl;
    existingLead.niche = niche;
    existingLead.scrapedAt = profile.scrapedAt;
    existingLead.rawData = profile.rawData;
    await existingLead.save();
    console.log(`Updated existing lead for @${profile.username}`);
    return existingLead;
  } else {
    const newLead = await Lead.create({
      username: profile.username,
      fullName: profile.fullName,
      bio: profile.bio,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      profileUrl: profile.profileUrl,
      niche: niche,
      scrapedAt: profile.scrapedAt,
      rawData: profile.rawData,
      foundVia: "instagram-scraper",
    });
    console.log(`Created new lead for @${profile.username}`);
    return newLead;
  }
}
