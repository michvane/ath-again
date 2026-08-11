import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "../types";
import { parseUnits, summarizeAssets } from "./core";

const asset = (currentValue: number, athValue: number): PortfolioAsset => ({
  id: `${currentValue}-${athValue}`,
  name: "Test asset",
  symbol: "TEST",
  amount: 1,
  image: null,
  currentPrice: currentValue,
  athPrice: athValue,
  athDate: null,
  currentValue,
  athValue,
});

describe("portfolio normalization", () => {
  it("parses integer token units without losing the useful decimal portion", () => {
    expect(parseUnits("1234567890000000000", 18)).toBeCloseTo(1.23456789);
    expect(parseUnits("invalid", 18)).toBe(0);
  });

  it("summarizes normalized assets", () => {
    expect(summarizeAssets([asset(100, 250), asset(50, 75)], 4)).toEqual({
      current: 150,
      ath: 325,
      upside: 175,
      multiplier: 325 / 150,
      matchedAssets: 2,
      eligibleAssets: 4,
    });
  });

  it("handles an empty current portfolio without dividing by zero", () => {
    expect(summarizeAssets([]).multiplier).toBe(0);
  });
});
