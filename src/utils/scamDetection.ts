
export interface ScamPattern {
  phrase: string;
  weight: number; // 0.1 to 1.0
  category: string;
}

// Database of common scammer phrases and patterns
export const SCAM_PATTERNS: ScamPattern[] = [
  // Urgency tactics
  { phrase: "act now", weight: 0.7, category: "urgency" },
  { phrase: "limited time", weight: 0.6, category: "urgency" },
  { phrase: "expires today", weight: 0.8, category: "urgency" },
  { phrase: "urgent action required", weight: 0.9, category: "urgency" },
  { phrase: "immediate response", weight: 0.7, category: "urgency" },
  
  // Financial threats
  { phrase: "account suspended", weight: 0.8, category: "financial" },
  { phrase: "unauthorized access", weight: 0.7, category: "financial" },
  { phrase: "verify your account", weight: 0.6, category: "financial" },
  { phrase: "payment failed", weight: 0.5, category: "financial" },
  { phrase: "refund pending", weight: 0.6, category: "financial" },
  
  // Authority impersonation
  { phrase: "irs calling", weight: 0.9, category: "authority" },
  { phrase: "social security", weight: 0.8, category: "authority" },
  { phrase: "legal action", weight: 0.7, category: "authority" },
  { phrase: "arrest warrant", weight: 0.9, category: "authority" },
  { phrase: "court case", weight: 0.6, category: "authority" },
  
  // Tech support
  { phrase: "computer infected", weight: 0.8, category: "tech" },
  { phrase: "virus detected", weight: 0.7, category: "tech" },
  { phrase: "microsoft support", weight: 0.8, category: "tech" },
  { phrase: "remote access", weight: 0.9, category: "tech" },
  { phrase: "fix your computer", weight: 0.6, category: "tech" },
  
  // Prize/lottery
  { phrase: "you've won", weight: 0.8, category: "prize" },
  { phrase: "congratulations", weight: 0.4, category: "prize" },
  { phrase: "lottery winner", weight: 0.9, category: "prize" },
  { phrase: "claim your prize", weight: 0.7, category: "prize" },
  { phrase: "free gift", weight: 0.5, category: "prize" },
  
  // Personal info requests
  { phrase: "confirm your", weight: 0.6, category: "personal" },
  { phrase: "social security number", weight: 0.9, category: "personal" },
  { phrase: "date of birth", weight: 0.7, category: "personal" },
  { phrase: "mother's maiden name", weight: 0.8, category: "personal" },
  { phrase: "bank account", weight: 0.8, category: "personal" },
  
  // Romance/relationship
  { phrase: "lonely", weight: 0.3, category: "romance" },
  { phrase: "love you", weight: 0.4, category: "romance" },
  { phrase: "send money", weight: 0.9, category: "romance" },
  { phrase: "emergency funds", weight: 0.8, category: "romance" },
  { phrase: "western union", weight: 0.9, category: "romance" },
];

export const detectScamLocally = (text: string): { score: number; matchedPatterns: ScamPattern[] } => {
  const lowerText = text.toLowerCase();
  const matchedPatterns: ScamPattern[] = [];
  
  for (const pattern of SCAM_PATTERNS) {
    if (lowerText.includes(pattern.phrase.toLowerCase())) {
      matchedPatterns.push(pattern);
    }
  }
  
  if (matchedPatterns.length === 0) {
    return { score: 0.1, matchedPatterns: [] };
  }
  
  // Calculate weighted score
  const totalWeight = matchedPatterns.reduce((sum, pattern) => sum + pattern.weight, 0);
  const avgWeight = totalWeight / matchedPatterns.length;
  
  // Boost score if multiple patterns match
  const multiplier = Math.min(1.5, 1 + (matchedPatterns.length - 1) * 0.1);
  const finalScore = Math.min(1.0, avgWeight * multiplier);
  
  return { score: finalScore, matchedPatterns };
};

export const getRiskLevel = (score: number): "low" | "medium" | "high" => {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
};
