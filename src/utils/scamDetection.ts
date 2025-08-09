
export interface ScamPattern {
  phrase: string;
  weight: number; // 0.1 to 1.0
  category: string;
  variants?: string[]; // common paraphrases
}

// Normalize text for matching
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union;
}

function charBigrams(s: string): string[] {
  const n = normalize(s);
  const arr: string[] = [];
  for (let i = 0; i < n.length - 1; i++) arr.push(n.slice(i, i + 2));
  return arr.length ? arr : [n];
}

function dice(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setB = new Set(b.map((x) => x));
  let overlap = 0;
  for (const x of a) if (setB.has(x)) overlap++;
  return (2 * overlap) / (a.length + b.length || 1);
}

function similarity(a: string, b: string): number {
  // combine token Jaccard and char bigram Dice
  const t = jaccard(tokens(a), tokens(b));
  const d = dice(charBigrams(a), charBigrams(b));
  return 0.5 * t + 0.5 * d;
}

export const SCAM_PATTERNS: ScamPattern[] = [
  // Urgency tactics
  { phrase: "act now", weight: 0.8, category: "urgency", variants: ["take action now", "right away"] },
  { phrase: "limited time", weight: 0.7, category: "urgency", variants: ["offer ends soon", "time sensitive"] },
  { phrase: "expires today", weight: 0.9, category: "urgency", variants: ["deadline today", "last day"] },
  { phrase: "urgent action required", weight: 1.0, category: "urgency", variants: ["urgent response required", "immediate attention required"] },
  { phrase: "immediate response", weight: 0.8, category: "urgency", variants: ["respond immediately"] },

  // Financial threats
  { phrase: "account suspended", weight: 0.95, category: "financial", variants: ["account locked", "account disabled"] },
  { phrase: "unauthorized access", weight: 0.85, category: "financial", variants: ["suspicious login", "security alert"] },
  { phrase: "verify your account", weight: 0.8, category: "financial", variants: ["confirm your account", "account verification"] },
  { phrase: "payment failed", weight: 0.7, category: "financial", variants: ["payment declined", "transaction failed"] },
  { phrase: "refund pending", weight: 0.75, category: "financial", variants: ["refund available", "claim refund"] },
  { phrase: "wire transfer", weight: 0.85, category: "financial", variants: ["bank transfer", "swift transfer"] },
  { phrase: "gift cards", weight: 0.9, category: "financial", variants: ["itune cards", "steam cards", "google play cards"] },

  // Authority impersonation
  { phrase: "irs calling", weight: 1.0, category: "authority", variants: ["tax department", "revenue service"] },
  { phrase: "social security", weight: 0.95, category: "authority", variants: ["ssa", "ssn"] },
  { phrase: "legal action", weight: 0.85, category: "authority", variants: ["lawsuit", "legal proceedings"] },
  { phrase: "arrest warrant", weight: 1.0, category: "authority", variants: ["police warrant", "custody order"] },
  { phrase: "court case", weight: 0.8, category: "authority", variants: ["court notice", "case against you"] },
  { phrase: "immigration department", weight: 0.9, category: "authority", variants: ["uscis", "visa suspension"] },

  // Tech support
  { phrase: "computer infected", weight: 0.9, category: "tech", variants: ["system infected", "device infected"] },
  { phrase: "virus detected", weight: 0.85, category: "tech", variants: ["malware detected", "trojan detected"] },
  { phrase: "microsoft support", weight: 0.9, category: "tech", variants: ["windows support", "tech support"] },
  { phrase: "remote access", weight: 1.0, category: "tech", variants: ["anydesk", "teamviewer", "share screen", "grant access"] },
  { phrase: "fix your computer", weight: 0.75, category: "tech", variants: ["repair your pc", "resolve issues"] },

  // Prize/lottery
  { phrase: "you've won", weight: 0.9, category: "prize", variants: ["you are a winner", "winner selected"] },
  { phrase: "congratulations", weight: 0.5, category: "prize", variants: ["lucky winner", "grand prize"] },
  { phrase: "lottery winner", weight: 1.0, category: "prize", variants: ["jackpot", "lottery prize"] },
  { phrase: "claim your prize", weight: 0.85, category: "prize", variants: ["collect your reward", "redeem prize"] },
  { phrase: "free gift", weight: 0.7, category: "prize", variants: ["complimentary gift", "no cost gift"] },

  // Personal info requests
  { phrase: "confirm your", weight: 0.75, category: "personal", variants: ["validate your", "verify your"] },
  { phrase: "social security number", weight: 1.0, category: "personal", variants: ["ssn", "social number"] },
  { phrase: "date of birth", weight: 0.85, category: "personal", variants: ["dob", "birth date"] },
  { phrase: "mother's maiden name", weight: 0.95, category: "personal", variants: ["maiden name"] },
  { phrase: "bank account", weight: 0.95, category: "personal", variants: ["account number", "routing number"] },
  { phrase: "one time password", weight: 0.95, category: "personal", variants: ["otp", "verification code"] },

  // Romance/relationship
  { phrase: "send money", weight: 1.0, category: "romance", variants: ["money transfer", "funds needed"] },
  { phrase: "emergency funds", weight: 0.95, category: "romance", variants: ["urgent money", "hospital bills"] },
  { phrase: "western union", weight: 1.0, category: "romance", variants: ["moneygram", "wire via wu"] },

  // Crypto / investment
  { phrase: "guaranteed returns", weight: 0.95, category: "investment", variants: ["sure profits", "risk-free returns"] },
  { phrase: "crypto wallet", weight: 0.9, category: "investment", variants: ["bitcoin wallet", "seed phrase"] },
  { phrase: "seed phrase", weight: 1.0, category: "investment", variants: ["private key", "recovery phrase"] },
  { phrase: "investment opportunity", weight: 0.8, category: "investment", variants: ["limited slots", "early access"] },
];

export const detectScamLocally = (text: string): { score: number; matchedPatterns: ScamPattern[] } => {
  const lowerText = normalize(text);
  const matchedPatterns: ScamPattern[] = [];

  for (const pattern of SCAM_PATTERNS) {
    const base = normalize(pattern.phrase);
    const variants = (pattern.variants || []).map((v) => normalize(v));

    // Direct includes (strong signal)
    if (lowerText.includes(base) || variants.some((v) => lowerText.includes(v))) {
      matchedPatterns.push(pattern);
      continue;
    }

    // Fuzzy match over sliding windows
    const windows = [pattern.phrase, ...(pattern.variants || [])];
    let maxSim = 0;
    for (const w of windows) {
      maxSim = Math.max(maxSim, similarity(lowerText, w));
    }
    if (maxSim >= 0.72) {
      matchedPatterns.push({ ...pattern, weight: Math.max(pattern.weight, Math.min(1, pattern.weight * (0.8 + 0.2 * maxSim))) });
    }
  }

  if (matchedPatterns.length === 0) {
    return { score: 0, matchedPatterns: [] };
  }

  // Aggregate score with category diversity boost
  const totalWeight = matchedPatterns.reduce((sum, p) => sum + p.weight, 0);
  const distinctCategories = new Set(matchedPatterns.map((p) => p.category)).size;
  const diversityBoost = 1 + Math.min(0.5, (distinctCategories - 1) * 0.15);
  let score = totalWeight / Math.max(1, matchedPatterns.length);
  score = Math.min(1, score * diversityBoost);

  // Strong signals escalation
  const hasCritical = matchedPatterns.some((p) => p.weight >= 0.95);
  if (hasCritical && matchedPatterns.length >= 2) score = Math.min(1, Math.max(score, 0.85));

  return { score, matchedPatterns };
};

export const getRiskLevel = (score: number): "low" | "medium" | "high" => {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
};
