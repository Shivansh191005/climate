import { RiskLevel } from "../api";

const COLORS: Record<RiskLevel, string> = {
  Low: "bg-green-100 text-risk-low border-risk-low",
  Moderate: "bg-amber-100 text-risk-moderate border-risk-moderate",
  High: "bg-red-100 text-risk-high border-risk-high",
};

export default function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${COLORS[level]}`}
    >
      {level === "High" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-high opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-risk-high" />
        </span>
      )}
      {level.toUpperCase()} RISK
    </span>
  );
}
