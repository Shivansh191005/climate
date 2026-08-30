export type RiskLevel = "Low" | "Moderate" | "High";

export interface FactorContribution {
  factor: string;
  percentage: number;
}

export interface PredictionResponse {
  id: number;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  env_probability: number;
  env_risk_level: RiskLevel;
  terrain_probability: number | null;
  terrain_label: string | null;
  final_probability: number;
  final_risk_level: RiskLevel;
  top_factors: FactorContribution[];
  created_at: string;
}

export interface AlertResponse {
  id: number;
  prediction_id: number;
  location_name: string;
  risk_level: RiskLevel;
  probability: number;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface AdminStats {
  total_predictions: number;
  risk_level_counts: Record<string, number>;
  total_alerts: number;
  unacknowledged_alerts: number;
  avg_final_probability: number;
  predictions_with_terrain_image: number;
}

export interface ModelInfo {
  tabular_training_results: {
    random_forest_baseline?: { f1_macro: number; auc_macro: number };
    xgboost?: { f1_macro: number; auc_macro: number };
  } | null;
  cnn_training_results: { best_val_accuracy: number; class_names: string[] } | null;
  environmental_weight: number;
  terrain_weight: number;
  high_risk_alert_threshold: number;
  bedrock_enabled: boolean;
}

export interface TrendPoint {
  created_at: string;
  final_probability: number;
  final_risk_level: RiskLevel;
}

export interface PredictionFormInput {
  location_name: string;
  latitude?: number;
  longitude?: number;
  temperature: number;
  humidity: number;
  precipitation: number;
  soil_moisture: number;
  elevation: number;
}

export interface HistoryFilters {
  limit?: number;
  riskLevel?: RiskLevel | "All";
  locationName?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  predictCombined: async (
    input: PredictionFormInput,
    imageFile?: File | null
  ): Promise<PredictionResponse> => {
    const form = new FormData();
    form.append("location_name", input.location_name);
    if (input.latitude !== undefined) form.append("latitude", String(input.latitude));
    if (input.longitude !== undefined) form.append("longitude", String(input.longitude));
    form.append("temperature", String(input.temperature));
    form.append("humidity", String(input.humidity));
    form.append("precipitation", String(input.precipitation));
    form.append("soil_moisture", String(input.soil_moisture));
    form.append("elevation", String(input.elevation));
    if (imageFile) form.append("file", imageFile);

    const res = await fetch(`${API_BASE_URL}/predict/combined`, {
      method: "POST",
      body: form,
    });
    return handleResponse<PredictionResponse>(res);
  },

  getHistory: async (filters: HistoryFilters = {}): Promise<PredictionResponse[]> => {
    const params = new URLSearchParams();
    params.set("limit", String(filters.limit ?? 50));
    if (filters.riskLevel && filters.riskLevel !== "All") params.set("risk_level", filters.riskLevel);
    if (filters.locationName) params.set("location_name", filters.locationName);

    const res = await fetch(`${API_BASE_URL}/history?${params.toString()}`);
    return handleResponse<PredictionResponse[]>(res);
  },

  deletePrediction: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/history/${id}`, { method: "DELETE" });
    await handleResponse(res);
  },

  getLocationTrend: async (locationName: string): Promise<TrendPoint[]> => {
    const res = await fetch(`${API_BASE_URL}/history/trend/${encodeURIComponent(locationName)}`);
    return handleResponse<TrendPoint[]>(res);
  },

  getAlerts: async (unacknowledgedOnly = false): Promise<AlertResponse[]> => {
    const res = await fetch(
      `${API_BASE_URL}/alerts?unacknowledged_only=${unacknowledgedOnly}`
    );
    return handleResponse<AlertResponse[]>(res);
  },

  acknowledgeAlert: async (alertId: number): Promise<AlertResponse> => {
    const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/acknowledge`, {
      method: "POST",
    });
    return handleResponse<AlertResponse>(res);
  },

  acknowledgeAllAlerts: async (): Promise<{ acknowledged_count: number }> => {
    const res = await fetch(`${API_BASE_URL}/alerts/acknowledge-all`, { method: "POST" });
    return handleResponse(res);
  },

  deleteAlert: async (alertId: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/alerts/${alertId}`, { method: "DELETE" });
    await handleResponse(res);
  },

  explainPrediction: async (
    predictionId: number,
    question?: string
  ): Promise<{ explanation: string; source: string }> => {
    const res = await fetch(`${API_BASE_URL}/assistant/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_id: predictionId, question }),
    });
    return handleResponse(res);
  },

  getAdminStats: async (): Promise<AdminStats> => {
    const res = await fetch(`${API_BASE_URL}/admin/stats`);
    return handleResponse<AdminStats>(res);
  },

  getModelInfo: async (): Promise<ModelInfo> => {
    const res = await fetch(`${API_BASE_URL}/admin/model-info`);
    return handleResponse<ModelInfo>(res);
  },
};
