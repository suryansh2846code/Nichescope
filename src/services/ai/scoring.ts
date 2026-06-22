// export function calculateLeadScore(
//   isLead: boolean,
//   confidence: number,
//   intent: string,
//   caption: string
// ): number {
//   let score = 0;
// 
//   if (isLead) {
//     score += 40;
//   }
// 
//   if (confidence > 90) {
//     score += 30;
//   }
// 
//   if (intent === "seeking_recommendation" || intent === "seeking_help") {
//     score += 20;
//   }
// 
//   if (caption && caption.trim().length > 30) {
//     score += 10;
//   }
// 
//   // Clamp score between 0 and 100
//   return Math.max(0, Math.min(100, score));
// }

export function calculateLeadScore(
  isLead: boolean,
  confidence: number,
  intent: string,
  caption: string,
  followingBoost: number = 0
): number {
  let score = 0;

  if (isLead) {
    score += 40;
  }

  if (confidence > 90) {
    score += 30;
  }

  if (intent === "seeking_recommendation" || intent === "seeking_help") {
    score += 20;
  }

  if (caption && caption.trim().length > 30) {
    score += 10;
  }

  score += followingBoost;

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}
