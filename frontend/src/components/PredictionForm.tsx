import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import RiskMap from "./RiskMap";
import LocationSearch from "./LocationSearch";
import { PredictionFormInput } from "../api";
import { GeocodeResult } from "../geocode";

interface Props {
  onSubmit: (input: PredictionFormInput, imageFile: File | null) => void;
  loading: boolean;
}

const DEFAULTS: PredictionFormInput = {
  location_name: "Darjeeling",
  latitude: 27.041,
  longitude: 88.2663,
  temperature: 22,
  humidity: 75,
  precipitation: 160,
  soil_moisture: 65,
  elevation: 2050,
};

// Representative feature values for each risk class, computed from the
// actual training dataset's per-class averages - lets you demo Low/Moderate/
// High outcomes instantly instead of guessing numbers by hand.
const PRESETS: Record<string, Omit<PredictionFormInput, "location_name" | "latitude" | "longitude">> = {
  Low: { temperature: 24.8, humidity: 61, precipitation: 119, soil_moisture: 53, elevation: 494 },
  Moderate: { temperature: 25.0, humidity: 81, precipitation: 160, soil_moisture: 74, elevation: 583 },
  High: { temperature: 24.8, humidity: 91, precipitation: 188, soil_moisture: 82, elevation: 703 },
};

function NumberField({
  label, value, min, max, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {label} <span className="text-slate-400 dark:text-slate-500">({unit})</span>
      </span>
      <input
        type="number"
        step="any"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

export default function PredictionForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<PredictionFormInput>(DEFAULTS);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const update = (patch: Partial<PredictionFormInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const fetchWeatherData = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,soil_moisture_3_to_9cm`);
      const data = await res.json();
      if (data.current) {
        update({
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          precipitation: data.current.precipitation,
          soil_moisture: data.current.soil_moisture_3_to_9cm * 100, // convert to percentage
          elevation: data.elevation,
        });
      }
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
    }
  };

  const handleSearchSelect = (result: GeocodeResult) => {
    update({
      location_name: result.display_name.split(",")[0],
      latitude: result.lat,
      longitude: result.lon,
    });
    fetchWeatherData(result.lat, result.lon);
  };

  const handleMapChange = (lat: number, lng: number, placeName?: string) => {
    update({ latitude: lat, longitude: lng, ...(placeName ? { location_name: placeName } : {}) });
    fetchWeatherData(lat, lng);
  };

  const applyPreset = (name: keyof typeof PRESETS) => update(PRESETS[name]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form, imageFile);
      }}
      className="space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5"
    >
      <div className="space-y-2">
        <LocationSearch onSelect={handleSearchSelect} />
        <label className="block">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Location name</span>
          <input
            type="text"
            value={form.location_name}
            onChange={(e) => update({ location_name: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            required
          />
        </label>
      </div>

      <RiskMap
        latitude={form.latitude ?? DEFAULTS.latitude!}
        longitude={form.longitude ?? DEFAULTS.longitude!}
        onChange={handleMapChange}
      />
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Search above or click the map — both fill in the place name and coordinates automatically.
      </p>

      <div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Quick demo — fill fields with a typical example of each risk level:
        </span>
        <div className="flex gap-2 mt-1.5">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => applyPreset(name)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                name === "Low"
                  ? "border-green-300 text-green-700 hover:bg-green-50"
                  : name === "Moderate"
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                  : "border-red-300 text-red-700 hover:bg-red-50"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Temperature" unit="°C" min={-10} max={50}
          value={form.temperature} onChange={(v) => update({ temperature: v })} />
        <NumberField label="Humidity" unit="%" min={0} max={100}
          value={form.humidity} onChange={(v) => update({ humidity: v })} />
        <NumberField label="Precipitation" unit="mm" min={0} max={500}
          value={form.precipitation} onChange={(v) => update({ precipitation: v })} />
        <NumberField label="Soil Moisture" unit="%" min={0} max={100}
          value={form.soil_moisture} onChange={(v) => update({ soil_moisture: v })} />
        <NumberField label="Elevation" unit="m" min={0} max={9000}
          value={form.elevation} onChange={(v) => update({ elevation: v })} />
      </div>

      <div>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Terrain image (optional)
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleImageChange}
          className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sky-700 hover:file:bg-sky-100 file:transition-colors"
        />
        {imagePreview && (
          <motion.img
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            src={imagePreview}
            alt="Terrain preview"
            className="mt-2 h-32 w-full object-cover rounded-md border border-slate-200 dark:border-slate-700"
          />
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-sky-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
            Predicting...
          </span>
        ) : (
          "Predict Landslide Risk"
        )}
      </motion.button>
    </motion.form>
  );
}
