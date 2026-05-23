import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

const host =
  (tag: string) =>
  ({ children, ...rest }: AnyProps) =>
    React.createElement(tag, rest, children);

const Mapbox = {
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn()
};

export default Mapbox;
export const MapView = host("MapboxMapView");
export const Camera = host("MapboxCamera");
export const PointAnnotation = host("MapboxPointAnnotation");
export const MarkerView = host("MapboxMarkerView");
export const ShapeSource = host("MapboxShapeSource");
export const LineLayer = host("MapboxLineLayer");
