import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
  onSelect
}: LocationSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeocodingResult[]>([]);
  const [loading, setLoading] = React.useState(false);
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
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        style={styles.input}
        accessibilityLabel="Tìm địa điểm"
      />
      {(loading || results.length > 0) && (
        <View style={styles.dropdown}>
          {loading && results.length === 0 ? (
            <Text style={styles.hint}>Đang tìm...</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setQuery(item.name);
                    setResults([]);
                  }}
                  style={styles.item}
                >
                  <Text>{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: 240
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  hint: { paddingHorizontal: 12, paddingVertical: 10, color: "#64748b" }
});
