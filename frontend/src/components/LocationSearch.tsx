import { useEffect, useRef, useState } from "react";
import { searchPlaces, GeocodeResult } from "../geocode";

interface Props {
  onSelect: (result: GeocodeResult) => void;
}

export default function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(query);
        setResults(found);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (result: GeocodeResult) => {
    setQuery(result.display_name.split(",")[0]);
    setOpen(false);
    onSelect(result);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search for a place (e.g. Darjeeling, India)"
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-shadow bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        />
        <svg
          className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        {loading && (
          <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-56 overflow-auto animate-fade-in">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
