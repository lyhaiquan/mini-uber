/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationSearch } from "../components/map/location-search";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LocationSearch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { id: "f1", place_name: "Bến Thành, Quận 1, TP HCM", center: [106.6985, 10.7724] },
            { id: "f2", place_name: "Bến Thành Market", center: [106.6991, 10.7726] }
          ]
        })
      }))
    );
  });

  it("debounces input and renders dropdown results", async () => {
    const onSelect = vi.fn();
    render(<LocationSearch token="pk.test" onSelect={onSelect} />);
    const input = screen.getByLabelText("Tìm địa điểm") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Bến Thành" } });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bến Thành, Quận 1, TP HCM" })
    );
  });

  it("skips fetch for queries shorter than 2 chars", async () => {
    render(<LocationSearch token="pk.test" onSelect={vi.fn()} />);
    const input = screen.getByLabelText("Tìm địa điểm") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "B" } });
    await new Promise((r) => setTimeout(r, 300));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
