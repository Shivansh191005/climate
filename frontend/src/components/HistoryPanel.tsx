import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, PredictionResponse, RiskLevel, TrendPoint } from "../api";
import RiskBadge from "./RiskBadge";
import { useToast } from "../Toast";

const FILTERS: Array<RiskLevel | "All"> = ["All", "Low", "Moderate", "High"];

function toCsv(rows: PredictionResponse[]): string {
  const header = [
    "id", "location_name", "env_risk_level", "terrain_label",
    "final_risk_level", "final_probability", "created_at",
  ];
  const lines = rows.map((p) =>
    [
      p.id, p.location_name, p.env_risk_level, p.terrain_label ?? "",
      p.final_risk_level, p.final_probability, p.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(rows: PredictionResponse[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `landsafe-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TrendSparkline({ locationName }: { locationName: string }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    api.getLocationTrend(locationName).then(setTrend).catch(() => setTrend([]));
  }, [locationName]);

  if (!trend) return <p className="text-xs text-slate-400 px-3 py-2">Loading trend...</p>;
  if (trend.length < 2) {
    return (
      <p className="text-xs text-slate-400 px-3 py-2">
        Need at least 2 predictions for {locationName} to show a trend.
      </p>
    );
  }

  const data = trend.map((t) => ({
    time: new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    probability: Math.round(t.final_probability * 100),
  }));

  return (
    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        Risk trend for {locationName}
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data}>
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Risk"]} />
          <Line type="monotone" dataKey="probability" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RiskLevel | "All">("All");
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    api
      .getHistory({ limit: 50 })
      .then(setHistory)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(
    () => (filter === "All" ? history : history.filter((p) => p.final_risk_level === filter)),
    [history, filter]
  );

  const handleDelete = async (id: number) => {
    try {
      await api.deletePrediction(id);
      setHistory((prev) => prev.filter((p) => p.id !== id));
      showToast("Prediction deleted", "info");
    } catch {
      showToast("Failed to delete prediction", "error");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Prediction History</h3>
        <button
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="text-xs font-medium text-sky-600 hover:text-sky-800 disabled:text-slate-300 dark:disabled:text-slate-600 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="flex gap-1.5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              filter === f
                ? "bg-slate-800 text-white border-slate-800 dark:bg-sky-600 dark:border-sky-600"
                : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">No predictions match this filter yet.</p>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <button
                  onClick={() =>
                    setExpandedLocation((cur) => (cur === p.location_name ? null : p.location_name))
                  }
                  className="text-left flex-1"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100">{p.location_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 dark:text-slate-300">
                    {(p.final_probability * 100).toFixed(0)}%
                  </span>
                  <RiskBadge level={p.final_risk_level} />
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                    title="Delete prediction"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                    </svg>
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {expandedLocation === p.location_name && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <TrendSparkline locationName={p.location_name} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
