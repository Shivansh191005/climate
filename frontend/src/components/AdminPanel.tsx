import { useEffect, useState } from "react";
import { api, AdminStats, ModelInfo } from "../api";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function AdminPanel({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getAdminStats(), api.getModelInfo()])
      .then(([s, m]) => {
        setStats(s);
        setModelInfo(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const xgb = modelInfo?.tabular_training_results?.xgboost;
  const rf = modelInfo?.tabular_training_results?.random_forest_baseline;
  const cnn = modelInfo?.cnn_training_results;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Admin — System Stats</h3>

        {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total predictions" value={stats.total_predictions} />
            <StatCard label="Total alerts" value={stats.total_alerts} />
            <StatCard label="Unacknowledged alerts" value={stats.unacknowledged_alerts} />
            <StatCard label="Low risk" value={stats.risk_level_counts["Low"] ?? 0} />
            <StatCard label="Moderate risk" value={stats.risk_level_counts["Moderate"] ?? 0} />
            <StatCard label="High risk" value={stats.risk_level_counts["High"] ?? 0} />
            <StatCard
              label="Avg. final probability"
              value={`${(stats.avg_final_probability * 100).toFixed(0)}%`}
            />
            <StatCard label="With terrain image" value={stats.predictions_with_terrain_image} />
          </div>
        )}
      </div>

      {modelInfo && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            About the Model
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="XGBoost macro F1"
              value={xgb ? xgb.f1_macro.toFixed(3) : "—"}
            />
            <StatCard
              label="XGBoost macro AUC"
              value={xgb ? xgb.auc_macro.toFixed(3) : "—"}
            />
            <StatCard
              label="RF baseline F1"
              value={rf ? rf.f1_macro.toFixed(3) : "—"}
            />
            <StatCard
              label="CNN val. accuracy"
              value={cnn ? `${(cnn.best_val_accuracy * 100).toFixed(1)}%` : "—"}
            />
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              Risk blend: {(modelInfo.environmental_weight * 100).toFixed(0)}% environmental /{" "}
              {(modelInfo.terrain_weight * 100).toFixed(0)}% terrain
            </p>
            <p>Alert threshold: {(modelInfo.high_risk_alert_threshold * 100).toFixed(0)}% final probability</p>
            <p>
              AI Assistant source:{" "}
              {modelInfo.bedrock_enabled ? "Amazon Bedrock" : "local rule-based fallback (Bedrock disabled)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
