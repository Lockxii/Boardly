import { describe, expect, it } from "vitest";
import { normalizeHex, parsePastedHexColors } from "./color-utils";

describe("normalizeHex", () => {
  it("normalizes 3- and 6-digit hex to #RRGGBB uppercase", () => {
    expect(normalizeHex("#f00")).toBe("#FF0000");
    expect(normalizeHex("00ff00")).toBe("#00FF00");
    expect(normalizeHex("#AbCdEf")).toBe("#ABCDEF");
  });
  it("rejects non-hex", () => {
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("#1234")).toBeNull();
  });
});

describe("parsePastedHexColors", () => {
  it("parses a single color and a palette", () => {
    expect(parsePastedHexColors("#FF0000")).toEqual(["#FF0000"]);
    expect(parsePastedHexColors("#FF0000, #00FF00 #0000FF")).toEqual(["#FF0000", "#00FF00", "#0000FF"]);
  });
  it("returns null for prose that merely contains a hex", () => {
    expect(parsePastedHexColors("the color is #FF0000 ok")).toBeNull();
    expect(parsePastedHexColors("hello world")).toBeNull();
    expect(parsePastedHexColors("")).toBeNull();
  });
});
