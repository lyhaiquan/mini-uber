"use client";

import * as React from "react";

import { Input } from "../input";

import type { LatLng } from "./types";

export interface GeocodingResult {
  id: string;
  name: string;
  coord: LatLng;
}

export interface LocationSearchProps {
  token: string;
  placeholder?: string;
  country?: string;
  language?: string;
  limit?: number;
  onSelect: (result: GeocodingResult) => void;
  className?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

const DEBOUNCE_MS = 250;

export function LocationSearch({
  token,
  placeholder = "Tìm địa điểm...",
  country = "VN",
  language = "vi",
  limit = 5,
  onSelect,
  className
}: LocationSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeocodingResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${encodeURIComponent(token)}&country=${country}&limit=${limit}&language=${language}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { features?: MapboxFeature[] };
        const features = data.features ?? [];
        setResults(
          features.map((f) => ({
            id: f.id,
            name: f.place_name,
            coord: { lng: f.center[0], lat: f.center[1] }
          }))
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, token, country, language, limit]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-label="Tìm địa điểm"
      />
      {open && (loading || results.length > 0) && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-900"
        >
          {loading && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-surface-500">Đang tìm...</li>
          ) : null}
          {results.map((r) => (
            <li
              key={r.id}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(r);
                setOpen(false);
                setQuery(r.name);
              }}
            >
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
