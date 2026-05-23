"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  MapView,
  SAIGON_FALLBACK,
  useCurrentLocation,
  type MapMarkerData
} from "@ridex/ui-web";
import * as React from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function DriverMap() {
  const { coords, isFallback, status } = useCurrentLocation();

  const markers = React.useMemo<MapMarkerData[]>(
    () => [
      {
        id: "self",
        coord: coords,
        variant: "self",
        heading: 0,
        label: "Vị trí của bạn"
      }
    ],
    [coords]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Cần Mapbox token</CardTitle>
          <CardDescription>
            Đặt <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> trong <code>.env.local</code>.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-surface-600 dark:text-surface-400">
        {status === "denied" || status === "unsupported"
          ? "Không truy cập được vị trí — đang hiển thị Sài Gòn."
          : isFallback
            ? "Đang tải vị trí..."
            : `Vị trí hiện tại: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
      </p>
      <div className="h-[480px] w-full overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
        <MapView
          token={MAPBOX_TOKEN}
          initialCenter={coords ?? SAIGON_FALLBACK}
          initialZoom={14}
          markers={markers}
        />
      </div>
    </section>
  );
}
