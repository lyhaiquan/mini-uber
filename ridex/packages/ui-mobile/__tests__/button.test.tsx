import * as React from "react";
import renderer from "react-test-renderer";

import { Button } from "../src/components/button";

describe("Button", () => {
  it("renders children text", () => {
    const tree = renderer.create(<Button>Đặt xe ngay</Button>).toJSON();
    expect(JSON.stringify(tree)).toContain("Đặt xe ngay");
  });

  it("marks Pressable disabled and swaps children for spinner when loading", () => {
    const root = renderer.create(<Button loading>Đặt xe ngay</Button>);
    const pressable = root.root.findByType("Pressable" as never) as unknown as {
      props: { disabled?: boolean };
    };
    expect(pressable.props.disabled).toBe(true);

    const serialized = JSON.stringify(root.toJSON());
    expect(serialized).toContain("ActivityIndicator");
    expect(serialized).not.toContain("Đặt xe ngay");
  });
});
