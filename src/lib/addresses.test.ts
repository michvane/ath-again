import { describe, expect, it } from "vitest";
import { detectAddress, ETHEREUM_ADDRESS, SOLANA_ADDRESS } from "./addresses";

describe("wallet address detection", () => {
  const ethereum = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const solana = "A1TMhSGzQxMr1TboBKtgixKz1sS6REASMxPo1qsyTSJd";

  it("recognizes an Ethereum address", () => {
    expect(ETHEREUM_ADDRESS.test(ethereum)).toBe(true);
    expect(detectAddress(`  ${ethereum} `)).toEqual({ ethereum });
  });

  it("recognizes a Solana address", () => {
    expect(SOLANA_ADDRESS.test(solana)).toBe(true);
    expect(detectAddress(solana)).toEqual({ solana });
  });

  it("rejects malformed and unsupported addresses", () => {
    expect(detectAddress("0x1234")).toBeNull();
    expect(detectAddress("not-a-wallet")).toBeNull();
  });
});
