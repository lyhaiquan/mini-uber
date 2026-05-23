"use client";

import * as React from "react";
import { Layer, Source } from "react-map-gl";

export interface MapRouteProps {
  geometry: GeoJSON.LineString;
  color?: string;
  width?: number;
}

export function MapRoute({ geometry, color = "#0a84ff", width = 4 }: MapRouteProps) {
  const data = React.useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({ type: "Feature", properties: {}, geometry }),
    [geometry]
  );
  return (
    <Source id="ridex-route" type="geojson" data={data}>
      <Layer
        id="ridex-route-line"
        type="line"
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": color, "line-width": width }}
      />
    </Source>
  );
}
