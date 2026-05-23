import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { TransitionButton } from "../transition-button";

void React;

// renderToStaticMarkup sidesteps the jsdom + UI-web Card chain that breaks
// pre-existing on this branch (same workaround as the Task 018/019 stepper
// tests). Validates the spec's state machine wiring: each driver-side status
// maps to exactly one next-step CTA.
describe("TransitionButton", () => {
  it("renders 'Đã đến điểm đón' for ACCEPTED → DRIVER_ARRIVED", () => {
    const out = renderToStaticMarkup(
      <TransitionButton status="ACCEPTED" pending={false} onTransition={vi.fn()} />
    );
    expect(out).toMatch(/Đã đến điểm đón/);
  });

  it("renders 'Bắt đầu chuyến' for DRIVER_ARRIVED → IN_PROGRESS", () => {
    const out = renderToStaticMarkup(
      <TransitionButton
        status="DRIVER_ARRIVED"
        pending={false}
        onTransition={vi.fn()}
      />
    );
    expect(out).toMatch(/Bắt đầu chuyến/);
  });

  it("renders 'Hoàn thành' for IN_PROGRESS → COMPLETED", () => {
    const out = renderToStaticMarkup(
      <TransitionButton status="IN_PROGRESS" pending={false} onTransition={vi.fn()} />
    );
    expect(out).toMatch(/Hoàn thành/);
  });

  it("renders nothing for terminal statuses (COMPLETED / CANCELLED)", () => {
    expect(
      renderToStaticMarkup(
        <TransitionButton status="COMPLETED" pending={false} onTransition={vi.fn()} />
      )
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <TransitionButton status="CANCELLED" pending={false} onTransition={vi.fn()} />
      )
    ).toBe("");
  });

  it("disables the button while a transition is pending", () => {
    const out = renderToStaticMarkup(
      <TransitionButton status="ACCEPTED" pending onTransition={vi.fn()} />
    );
    expect(out).toMatch(/disabled=""/);
  });
});
