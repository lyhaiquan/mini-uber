import * as React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";

import { Button } from "../src/components/button";

describe("Button", () => {
  it("renders children text", () => {
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = renderer.create(<Button>Book ride now</Button>);
    });

    const tree = root?.toJSON();
    expect(JSON.stringify(tree)).toContain("Book ride now");
  });

  it("marks Pressable disabled and swaps children for spinner when loading", () => {
    let root: ReactTestRenderer | undefined;
    act(() => {
      root = renderer.create(<Button loading>Book ride now</Button>);
    });

    if (root === undefined) throw new Error("Button renderer was not created");

    const pressable = root.root.findByType("Pressable" as never) as unknown as {
      props: { disabled?: boolean };
    };
    expect(pressable.props.disabled).toBe(true);

    const serialized = JSON.stringify(root.toJSON());
    expect(serialized).toContain("ActivityIndicator");
    expect(serialized).not.toContain("Book ride now");
  });
});
