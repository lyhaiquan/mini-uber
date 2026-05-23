const React = require("react");

const host =
  (tag) =>
  ({ children, ...rest }) =>
    React.createElement(tag, rest, children);

const Mapbox = {
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn()
};

module.exports = {
  __esModule: true,
  default: Mapbox,
  MapView: host("MapboxMapView"),
  Camera: host("MapboxCamera"),
  PointAnnotation: host("MapboxPointAnnotation"),
  MarkerView: host("MapboxMarkerView"),
  ShapeSource: host("MapboxShapeSource"),
  LineLayer: host("MapboxLineLayer")
};
