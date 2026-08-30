import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, PredictionResponse } from "../api";

export default function AIAssistant({ prediction }: { prediction: PredictionResponse | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!prediction) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.explainPrediction(prediction.id, question || undefined);
      setAnswer(res.explanation);
      setSource(res.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!prediction) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 text-sm text-slate-500 dark:text-slate-400">
        Run a prediction first, then ask the AI assistant to explain it.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Ask LandSafe AI about {prediction.location_name}
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why is this area risky? (optional)"
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        />
        <button
          onClick={ask}
          disabled={loading}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
              Thinking
            </span>
          ) : (
            "Ask"
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg bg-sky-50 p-4 text-sm text-slate-700 dark:text-slate-200"
          >
            <p>{answer}</p>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Source: {source === "bedrock" ? "Amazon Bedrock" : "local rule-based explainer (Bedrock not configured)"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
