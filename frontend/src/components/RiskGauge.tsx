import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { RiskLevel } from "../api";

const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "#16a34a",
  Moderate: "#f59e0b",
  High: "#dc2626",
};

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RiskGauge({
  probability,
  level,
}: {
  probability: number; // 0-1
  level: RiskLevel;
}) {
  const progress = useMotionValue(0);
  const [displayPct, setDisplayPct] = useState(0);
  const strokeDashoffset = useTransform(progress, (v) => CIRCUMFERENCE * (1 - v));

  useEffect(() => {
    const controls = animate(progress, probability, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (v) => setDisplayPct(Math.round(v * 100)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probability]);

  const color = RISK_COLORS[level];

  return (
    <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle
          cx="64" cy="64" r={RADIUS}
          fill="none" stroke="#e2e8f0" strokeWidth="10"
        />
        <motion.circle
          cx="64" cy="64" r={RADIUS}
          fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          key={level}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-extrabold text-slate-900"
        >
          {displayPct}%
        </motion.span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">risk</span>
      </div>
    </div>
  );
}
