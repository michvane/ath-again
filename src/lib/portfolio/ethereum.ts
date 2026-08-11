import type { PortfolioAsset, PortfolioResponse } from "../types";
import { buildWalletResponse, enrichCandidate, parseUnits, type Candidate } from "./core";

const BLOCKSCOUT = "https://eth.blockscout.com/api/v2";
const MAX_ERC20_LOOKUPS = 9;

type BlockscoutTokenBalance = {
  token: {
    address_hash: string;
    decimals: string | null;
    exchange_rate: string | null;
    icon_url: string | null;
    name: string;
    symbol: string;
    type: string;
  };
  value: string;
};

type BlockscoutTokenPage = { items: BlockscoutTokenBalance[] };
type BlockscoutAddress = { coin_balance: string };
type BlockscoutStats = { coin_price: string | null };

async function blockscout<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${BLOCKSCOUT}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error("That address has no Ethereum history yet.");
      throw new Error("Ethereum holdings are taking a coffee break. Try again shortly.");
    }
    return response.json() as Promise<T>;
  } catch (caught) {
    if (caught instanceof Error && caught.message.includes("no Ethereum history")) throw caught;
    throw new Error("Ethereum holdings are taking a coffee break. Try again shortly.");
  }
}

export async function getEthereumPortfolio(address: string): Promise<PortfolioResponse> {
  const [account, balances, stats] = await Promise.all([
    blockscout<BlockscoutAddress>(`/addresses/${address}`),
    blockscout<BlockscoutTokenPage>(`/addresses/${address}/tokens?type=ERC-20`),
    blockscout<BlockscoutStats>("/stats"),
  ]);

  const candidates: Candidate[] = [];
  const nativeAmount = parseUnits(account.coin_balance || "0", 18);
  const nativePrice = Number(stats.coin_price || 0);
  if (nativeAmount > 0 && nativePrice > 0) {
    candidates.push({ id: "ethereum", chain: "Ethereum", platform: "ethereum", contract: null, name: "Ethereum", symbol: "ETH", amount: nativeAmount, currentPrice: nativePrice, image: null });
  }

  const erc20s = balances.items
    .filter(({ token }) => token.type === "ERC-20" && token.decimals && token.exchange_rate)
    .map(({ token, value }) => ({
      id: token.address_hash.toLowerCase(),
      chain: "Ethereum",
      platform: "ethereum",
      contract: token.address_hash.toLowerCase(),
      name: token.name,
      symbol: token.symbol,
      amount: parseUnits(value, Number(token.decimals)),
      currentPrice: Number(token.exchange_rate || 0),
      image: token.icon_url,
    } satisfies Candidate))
    .filter((token) => Number.isFinite(token.currentPrice) && token.amount * token.currentPrice >= 0.5)
    .sort((a, b) => b.amount * b.currentPrice - a.amount * a.currentPrice);

  const eligibleAssets = candidates.length + erc20s.length;
  candidates.push(...erc20s.slice(0, MAX_ERC20_LOOKUPS));
  const enriched = (await Promise.all(candidates.map(enrichCandidate))).filter((asset): asset is PortfolioAsset => Boolean(asset));
  enriched.sort((a, b) => b.currentValue - a.currentValue);
  if (!enriched.length) throw new Error("We found the wallet, but none of its priced tokens have usable ATH data.");

  const omitted = Math.max(0, eligibleAssets - enriched.length);
  const note = `Ethereum. Based on ${enriched.length} token${enriched.length === 1 ? "" : "s"} with verified CoinGecko ATH data${omitted ? `; ${omitted} smaller or unmatched asset${omitted === 1 ? " was" : "s were"} left out` : ""}.`;
  return buildWalletResponse(address, "ethereum", "Ethereum", enriched, eligibleAssets, note);
}
