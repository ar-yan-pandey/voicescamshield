import React from "react";
import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high";

export interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
  risk: RiskLevel;
  score: number; // 0..1
  language?: string;
}

interface TranscriptListProps {
  items: TranscriptItem[];
  className?: string;
}

const riskBadge = (risk: RiskLevel) => {
  switch (risk) {
    case "low":
      return "bg-secondary text-secondary-foreground";
    case "medium":
      return "bg-accent text-accent-foreground";
    case "high":
      return "bg-destructive text-destructive-foreground";
  }
};

export const TranscriptList: React.FC<TranscriptListProps> = ({ items, className }) => {
  return (
    <section className={cn("space-y-3", className)} aria-live="polite" aria-relevant="additions">
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Waiting for transcript…</div>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border bg-card text-card-foreground p-3 shadow-sm transition-smooth hover:shadow-glow"
          >
            <div className="flex items-center justify-start gap-3">
              <div className="text-sm text-muted-foreground">{item.timestamp}</div>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{item.text}</p>
          </article>
        ))
      )}
    </section>
  );
};

export default TranscriptList;
