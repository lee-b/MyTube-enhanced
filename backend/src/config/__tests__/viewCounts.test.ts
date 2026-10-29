import { describe, expect, it } from "vitest";
import {
  isViewCountDisplayEnabled,
  parseShowViewCounts,
} from "../viewCounts";

describe("viewCounts config", () => {
  it("defaults to hidden when the env var is unset or empty", () => {
    expect(parseShowViewCounts(undefined)).toBe(false);
    expect(parseShowViewCounts("")).toBe(false);
  });

  it("enables display only for true/1", () => {
    expect(parseShowViewCounts("true")).toBe(true);
    expect(parseShowViewCounts("1")).toBe(true);
  });

  it("treats other values as disabled", () => {
    expect(parseShowViewCounts("false")).toBe(false);
    expect(parseShowViewCounts("yes")).toBe(false);
    expect(parseShowViewCounts("TRUE")).toBe(false);
  });

  it("reads the environment at call time", () => {
    const previous = process.env.MYTUBE_SHOW_VIEW_COUNTS;
    try {
      process.env.MYTUBE_SHOW_VIEW_COUNTS = "true";
      expect(isViewCountDisplayEnabled()).toBe(true);
      process.env.MYTUBE_SHOW_VIEW_COUNTS = undefined;
      expect(isViewCountDisplayEnabled()).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.MYTUBE_SHOW_VIEW_COUNTS;
      } else {
        process.env.MYTUBE_SHOW_VIEW_COUNTS = previous;
      }
    }
  });
});
