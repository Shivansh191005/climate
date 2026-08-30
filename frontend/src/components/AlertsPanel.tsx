import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, AlertResponse } from "../api";
import { useToast } from "../Toast";

export default function AlertsPanel({ refreshKey }: { refreshKey: number }) {
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    api
      .getAlerts(false)
      .then(setAlerts)
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

  const acknowledge = async (id: number) => {
    await api.acknowledgeAlert(id);
    load();
  };

  const acknowledgeAll = async () => {
    const { acknowledged_count } = await api.acknowledgeAllAlerts();
    showToast(`Acknowledged ${acknowledged_count} alert${acknowledged_count === 1 ? "" : "s"}`, "success");
    load();
  };

  const remove = async (id: number) => {
    await api.deleteAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Alerts</h3>
        {unacknowledgedCount > 0 && (
          <button
            onClick={acknowledgeAll}
            className="text-xs font-medium text-sky-600 hover:text-sky-800 transition-colors"
          >
            Acknowledge all ({unacknowledgedCount})
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
      {!loading && alerts.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">No alerts yet.</p>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {alerts.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className={`group rounded-lg border px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                a.acknowledged
                  ? "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 text-slate-400 dark:text-slate-500"
                  : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
              }`}
            >
              <span>{a.message}</span>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {!a.acknowledged && (
                  <button
                    onClick={() => acknowledge(a.id)}
                    className="text-xs font-semibold underline hover:text-red-900 dark:hover:text-red-200 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={() => remove(a.id)}
                  className="opacity-0 group-hover:opacity-100 text-current hover:text-slate-700 dark:hover:text-white transition-all"
                  title="Delete alert"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
