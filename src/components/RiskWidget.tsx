import React from "react";
import { RiskLevel } from "./TranscriptList";

interface RiskWidgetProps {
  value: number; // 0..100
  level: RiskLevel;
}

const RiskWidget: React.FC<RiskWidgetProps> = ({ value, level }) => {
  const radius = 36;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const clamped = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const colorClass =
    level === "high" ? "text-destructive" : level === "medium" ? "text-accent" : "text-primary";

  return (
    <aside className="fixed bottom-6 right-6 z-40">
      <div className="relative w-[112px] h-[112px] rounded-2xl border bg-card/80 backdrop-blur-md shadow-glow p-4">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90 block mx-auto">
          <circle
            stroke="hsl(var(--muted))"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="opacity-40"
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeLinecap="round"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            className={colorClass}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-2xl font-semibold">{clamped.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Scam risk</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RiskWidget;
