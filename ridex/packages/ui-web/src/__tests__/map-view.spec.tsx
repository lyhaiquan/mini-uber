/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));
vi.mock("react-map-gl", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-mapbox-map">{children}</div>
  ),
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-marker">{children}</div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-source">{children}</div>
  ),
  Layer: () => <div data-testid="mock-layer" />,
  NavigationControl: () => <div data-testid="mock-nav" />
}));

import { MapView } from "../components/map/map-view";

afterEach(() => cleanup());

describe("MapView", () => {
  it("renders one marker per data entry plus route source when provided", () => {
    const { getAllByTestId, queryByTestId } = render(
      <MapView
        token="pk.test"
        markers={[
          { id: "a", coord: { lat: 10, lng: 106 } },
          { id: "b", coord: { lat: 11, lng: 107 }, variant: "destination" }
        ]}
        route={{
          type: "LineString",
          coordinates: [
            [106, 10],
            [107, 11]
          ]
        }}
      />
    );
    expect(getAllByTestId("mock-marker")).toHaveLength(2);
    expect(queryByTestId("mock-source")).toBeTruthy();
  });

  it("renders without route", () => {
    const { queryByTestId } = render(<MapView token="pk.test" />);
    expect(queryByTestId("mock-mapbox-map")).toBeTruthy();
    expect(queryByTestId("mock-source")).toBeNull();
  });
});
