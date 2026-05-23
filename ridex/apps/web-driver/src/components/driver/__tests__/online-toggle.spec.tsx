import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { OnlineToggle } from "../online-toggle";

void React;

// renderToStaticMarkup sidesteps the jsdom + UI-web Card chain that is broken
// pre-existing on this branch (same workaround as Task 018 stepper test).
describe("OnlineToggle", () => {
  it("renders 'GO' when offline", () => {
    const out = renderToStaticMarkup(
      <OnlineToggle state="offline" onGo={() => undefined} onStop={() => undefined} />
    );
    expect(out).toMatch(/data-state="offline"/);
    expect(out).toMatch(/>GO</);
  });

  it("renders 'STOP' when online and uses emerald color class", () => {
    const out = renderToStaticMarkup(
      <OnlineToggle state="online" onGo={() => undefined} onStop={() => undefined} />
    );
    expect(out).toMatch(/data-state="online"/);
    expect(out).toMatch(/>STOP</);
    expect(out).toMatch(/bg-emerald-600/);
  });

  it("shows the going-online label and is disabled while pending", () => {
    const out = renderToStaticMarkup(
      <OnlineToggle
        state="going-online"
        onGo={() => undefined}
        onStop={() => undefined}
      />
    );
    expect(out).toMatch(/Đang bật\.\.\./);
    expect(out).toMatch(/disabled=""/);
  });

  it("is disabled when permission-denied is forced via disabled prop", () => {
    const out = renderToStaticMarkup(
      <OnlineToggle
        state="offline"
        disabled
        onGo={() => undefined}
        onStop={() => undefined}
      />
    );
    expect(out).toMatch(/disabled=""/);
  });
});
