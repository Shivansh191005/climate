import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import HistoryPanel from "./components/HistoryPanel";
import AlertsPanel from "./components/AlertsPanel";
import AIAssistant from "./components/AIAssistant";
import AdminPanel from "./components/AdminPanel";
import { api, PredictionFormInput, PredictionResponse } from "./api";
import { useTheme } from "./useTheme";
import { useToast } from "./Toast";

export default function App() {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const handlePredict = async (input: PredictionFormInput, imageFile: File | null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.predictCombined(input, imageFile);
      setPrediction(result);
      setRefreshKey((k) => k + 1); // refresh history + alerts panels

      if (result.final_risk_level === "High") {
        showToast(`⚠️ High risk detected at ${result.location_name}`, "warning");
      } else {
        showToast(`Prediction complete: ${result.final_risk_level} risk`, "success");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Prediction failed";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 transition-colors">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🏔️</span> LandSafe AI
            </h1>
            <p className="text-sm text-slate-300">
              AI-powered landslide risk prediction &amp; early warning
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="text-sm text-slate-200 hover:text-white border border-slate-600 hover:border-slate-400 rounded-md p-1.5 transition-colors"
              title="Toggle dark mode"
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowAdmin((s) => !s)}
              className="text-sm font-medium text-slate-200 hover:text-white border border-slate-600 hover:border-slate-400 rounded-md px-3 py-1.5 transition-colors"
            >
              {showAdmin ? "Hide Admin" : "Admin"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AnimatePresence>
          {showAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden print:hidden"
            >
              <AdminPanel refreshKey={refreshKey} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: input + result */}
          <div className="space-y-6">
            <div className="print:hidden">
              <PredictionForm onSubmit={handlePredict} loading={loading} />
            </div>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3 print:hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {prediction && (
                <div id="prediction-report">
                  <PredictionResult key={prediction.id} prediction={prediction} />
                  <button
                    onClick={() => window.print()}
                    className="mt-2 text-xs font-medium text-sky-600 hover:text-sky-800 print:hidden"
                  >
                    Print / Save as PDF
                  </button>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: AI assistant, alerts, history */}
          <div className="space-y-6 print:hidden">
            <AIAssistant prediction={prediction} />
            <AlertsPanel refreshKey={refreshKey} />
            <HistoryPanel refreshKey={refreshKey} />
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-xs text-slate-400 dark:text-slate-600 print:hidden">
        Prototype system for educational/SIH purposes. Predictions are model-generated
        estimates, not official safety guidance.
      </footer>
    </div>
  );
}
