import { describe, expect, it } from "vitest";

import type { RideStatus } from "@ridex/shared-types";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { StateMachineStepper } from "../state-machine-stepper";

void React;

// renderToStaticMarkup keeps this test free of the jsdom + Card transitive
// dependency chain that is currently broken on this branch (see fare-estimate-
// card.spec.tsx which fails identically before this change).
function html(status: RideStatus): string {
  return renderToStaticMarkup(<StateMachineStepper status={status} />);
}

describe("StateMachineStepper", () => {
  it("marks REQUESTED as the current step and remaining as future", () => {
    const out = html("REQUESTED");
    expect(out).toMatch(/data-status="REQUESTED"[^>]*data-state="current"/);
    expect(out).toMatch(/data-status="MATCHING"[^>]*data-state="future"/);
    expect(out).toMatch(/data-status="COMPLETED"[^>]*data-state="future"/);
  });

  it("collapses DRIVER_ARRIVED into the ACCEPTED step (current)", () => {
    const out = html("DRIVER_ARRIVED");
    expect(out).toMatch(/data-status="ACCEPTED"[^>]*data-state="current"/);
  });

  it("marks every step past current as past when status=IN_PROGRESS", () => {
    const out = html("IN_PROGRESS");
    expect(out).toMatch(/data-status="REQUESTED"[^>]*data-state="past"/);
    expect(out).toMatch(/data-status="MATCHING"[^>]*data-state="past"/);
    expect(out).toMatch(/data-status="ACCEPTED"[^>]*data-state="past"/);
    expect(out).toMatch(/data-status="IN_PROGRESS"[^>]*data-state="current"/);
  });

  it("renders an error chip for CANCELLED instead of the progress rail", () => {
    const out = html("CANCELLED");
    expect(out).toMatch(/aria-label="ride-cancelled"/);
    expect(out).not.toMatch(/aria-label="ride-progress"/);
  });

  it("renders a no-drivers-found chip for NO_DRIVERS_FOUND", () => {
    const out = html("NO_DRIVERS_FOUND");
    expect(out).toMatch(/aria-label="no-drivers-found"/);
  });
});
