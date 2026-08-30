import { motion } from "framer-motion";
import { PredictionResponse } from "../api";
import RiskBadge from "./RiskBadge";
import RiskGauge from "./RiskGauge";
import ShapChart from "./ShapChart";

export default function PredictionResult({ prediction }: { prediction: PredictionResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{prediction.location_name}</h2>
          <div className="mt-2">
            <RiskBadge level={prediction.final_risk_level} />
          </div>
        </div>
        <RiskGauge probability={prediction.final_probability} level={prediction.final_risk_level} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="rounded-lg bg-slate-50 p-3"
        >
          <p className="text-slate-500 dark:text-slate-400">Environmental model</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {prediction.env_risk_level} ({(prediction.env_probability * 100).toFixed(0)}%)
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="rounded-lg bg-slate-50 p-3"
        >
          <p className="text-slate-500 dark:text-slate-400">Terrain image model</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {prediction.terrain_label
              ? `${prediction.terrain_label.replace("_", " ")} (${(
                  (prediction.terrain_probability ?? 0) * 100
                ).toFixed(0)}%)`
              : "No image provided"}
          </p>
        </motion.div>
      </div>

      <ShapChart factors={prediction.top_factors} />

      <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
        Final risk blends the environmental and terrain models (70% / 30%) per this
        prototype's documented risk-combination rule — a design assumption, not a
        scientifically validated model.
      </p>
    </motion.div>
  );
}
