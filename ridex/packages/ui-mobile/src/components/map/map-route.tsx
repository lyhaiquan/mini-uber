import { LineLayer, ShapeSource } from "@rnmapbox/maps";
import * as React from "react";

export interface MapRouteProps {
  geometry: GeoJSON.LineString;
  color?: string;
  width?: number;
}

export function MapRoute({ geometry, color = "#0a84ff", width = 4 }: MapRouteProps) {
  const shape = React.useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({ type: "Feature", properties: {}, geometry }),
    [geometry]
  );
  return (
    <ShapeSource id="ridex-route" shape={shape}>
      <LineLayer
        id="ridex-route-line"
        style={{ lineColor: color, lineWidth: width, lineCap: "round", lineJoin: "round" }}
      />
    </ShapeSource>
  );
}
