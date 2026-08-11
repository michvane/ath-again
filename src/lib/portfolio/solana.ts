import type { PortfolioAsset, PortfolioResponse } from "../types";
import { buildWalletResponse, enrichCandidate, type Candidate } from "./core";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const DEXSCREENER = "https://api.dexscreener.com/tokens/v1/solana";
const MAX_SOLANA_LOOKUPS = 9;
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type SolanaTokenAccount = {
  account: {
    data: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: { uiAmountString?: string };
        };
      };
    };
  };
};

type SolanaRpcResponse<T> = { result?: T; error?: { message?: string } };
type DexScreenerPair = {
  baseToken?: { address?: string };
  priceUsd?: string | null;
  liquidity?: { usd?: number };
};

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Solana holdings are temporarily unavailable.");
  const body = await response.json() as SolanaRpcResponse<T>;
  if (body.error || body.result === undefined) throw new Error(body.error?.message || "Solana holdings are temporarily unavailable.");
  return body.result;
}

async function getSolanaPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  const prices: Record<string, number> = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1,
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1,
  };
  try {
    const response = await fetch(`${DEXSCREENER}/${mints.slice(0, 30).join(",")}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 5 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return prices;
    const pairs = await response.json() as DexScreenerPair[];
    const bestLiquidity = new Map<string, number>();
    for (const pair of pairs) {
      const mint = pair.baseToken?.address;
      const value = Number(pair.priceUsd || 0);
      const liquidity = Number(pair.liquidity?.usd || 0);
      if (!mint || !Number.isFinite(value) || value <= 0 || liquidity <= (bestLiquidity.get(mint) || -1)) continue;
      prices[mint] = value;
      bestLiquidity.set(mint, liquidity);
    }
    return prices;
  } catch {
    return prices;
  }
}

export async function getSolanaPortfolio(address: string): Promise<PortfolioResponse> {
  const tokenParams = (programId: string) => [address, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }];
  const [balance, legacy, token2022] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]),
    solanaRpc<{ value: SolanaTokenAccount[] }>("getTokenAccountsByOwner", tokenParams(SPL_TOKEN_PROGRAM)),
    solanaRpc<{ value: SolanaTokenAccount[] }>("getTokenAccountsByOwner", tokenParams(TOKEN_2022_PROGRAM)),
  ]);

  const tokenAmounts = new Map<string, number>();
  for (const item of [...legacy.value, ...token2022.value]) {
    const info = item.account.data.parsed?.info;
    const amount = Number(info?.tokenAmount?.uiAmountString || 0);
    if (info?.mint && Number.isFinite(amount) && amount > 0) tokenAmounts.set(info.mint, (tokenAmounts.get(info.mint) || 0) + amount);
  }

  const mints = [...tokenAmounts.keys()];
  const prices = await getSolanaPrices(mints);
  const candidates: Candidate[] = [];
  const solAmount = balance.value / 1_000_000_000;
  if (solAmount > 0) {
    candidates.push({ id: "solana", chain: "Solana", platform: "solana", contract: null, name: "Solana", symbol: "SOL", amount: solAmount, currentPrice: 0, image: null });
  }

  const pricedTokens = mints
    .map((mint) => ({ mint, amount: tokenAmounts.get(mint) || 0, currentPrice: Number(prices[mint] || 0) }))
    .filter((token) => token.currentPrice > 0 && token.amount * token.currentPrice >= 0.5)
    .sort((a, b) => b.amount * b.currentPrice - a.amount * a.currentPrice)
    .slice(0, MAX_SOLANA_LOOKUPS);
  candidates.push(...pricedTokens.map(({ mint, amount, currentPrice }) => ({
    id: mint,
    chain: "Solana",
    platform: "solana",
    contract: mint,
    name: "",
    symbol: "",
    amount,
    currentPrice,
    image: null,
  })));

  const enriched = (await Promise.all(candidates.map(enrichCandidate))).filter((asset): asset is PortfolioAsset => Boolean(asset));
  enriched.sort((a, b) => b.currentValue - a.currentValue);
  if (!enriched.length) throw new Error("We found the Solana account, but none of its priced assets have usable ATH data.");

  const note = `Solana. Based on ${enriched.length} asset${enriched.length === 1 ? "" : "s"} with verified CoinGecko ATH data.`;
  return buildWalletResponse(address, "solana", "Solana", enriched, candidates.length, note);
}
