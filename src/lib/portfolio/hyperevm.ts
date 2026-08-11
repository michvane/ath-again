import type { PortfolioResponse } from "../types";
import { buildWalletResponse, enrichCandidate, parseUnits } from "./core";

const HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";

export async function getHyperEvmPortfolio(address: string): Promise<PortfolioResponse | null> {
  const response = await fetch(HYPEREVM_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("HyperEVM holdings are temporarily unavailable.");
  const body = await response.json() as { result?: string };
  if (!body.result) throw new Error("HyperEVM holdings are temporarily unavailable.");

  const amount = parseUnits(BigInt(body.result).toString(), 18);
  if (amount <= 0) return null;
  const asset = await enrichCandidate({ id: "hyperliquid", chain: "HyperEVM", platform: "hyperevm", contract: null, name: "Hyperliquid", symbol: "HYPE", amount, currentPrice: 0, image: null });
  if (!asset) return null;
  return buildWalletResponse(address, "hyperevm", "HyperEVM", [asset], 1, "HyperEVM native HYPE balance.");
}
