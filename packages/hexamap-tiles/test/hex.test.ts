import { describe, expect, it } from "vitest";
import { hexToPixel, offsetToAxial, pixelToHex } from "../src/core/hex";

describe("hex math", () => {
  it("round-trips centers", () => {
    for (const [q, r] of [[0, 0], [3, -2], [-5, 7], [12, 4]] as const) {
      const [x, y] = hexToPixel(q, r, 7);
      expect(pixelToHex(x, y, 7)).toEqual({ q, r });
    }
  });
  it("snaps nearby points to the containing hex", () => {
    const [x, y] = hexToPixel(4, 3, 10);
    expect(pixelToHex(x + 4, y - 4, 10)).toEqual({ q: 4, r: 3 });
  });
  it("converts odd-r offsets", () => {
    expect(offsetToAxial(2, 1)).toEqual({ q: 2, r: 1 });
    expect(offsetToAxial(2, 2)).toEqual({ q: 1, r: 2 });
  });
});
