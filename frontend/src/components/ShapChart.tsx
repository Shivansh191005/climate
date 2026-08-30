import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FactorContribution } from "../api";

const BAR_COLORS = ["#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f97316"];

const LABELS: Record<string, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  precipitation: "Precipitation",
  soil_moisture: "Soil Moisture",
  elevation: "Elevation",
};

export default function ShapChart({ factors }: { factors: FactorContribution[] }) {
  const data = factors.map((f) => ({
    name: LABELS[f.factor] || f.factor,
    percentage: f.percentage,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
        Why this prediction? (SHAP factor contributions)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" unit="%" domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="name" width={100} />
          <Tooltip formatter={(value: number) => [`${value}%`, "Contribution"]} />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
