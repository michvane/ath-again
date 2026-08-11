import type { PortfolioAsset, PortfolioResponse } from "./types";

const BLOCKSCOUT = "https://eth.blockscout.com/api/v2";
const COINGECKO = "https://api.coingecko.com/api/v3";
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

type CoinGeckoCoin = {
  id: string;
  name: string;
  symbol: string;
  image?: { small?: string };
  market_data?: {
    current_price?: { usd?: number };
    ath?: { usd?: number };
    ath_date?: { usd?: string };
  };
};

type Candidate = {
  id: string;
  contract: string | null;
  name: string;
  symbol: string;
  amount: number;
  currentPrice: number;
  image: string | null;
};

function parseUnits(raw: string, decimals: number): number {
  try {
    const value = BigInt(raw);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const remainder = (value % divisor).toString().padStart(decimals, "0").slice(0, 12);
    return Number(whole) + Number(`0.${remainder || "0"}`);
  } catch {
    return 0;
  }
}

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

async function coinGecko(path: string): Promise<CoinGeckoCoin | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_DEMO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_DEMO_API_KEY;
  }

  try {
    const response = await fetch(`${COINGECKO}${path}`, {
      headers,
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404 || !response.ok) return null;
    return response.json() as Promise<CoinGeckoCoin>;
  } catch {
    return null;
  }
}

async function enrich(candidate: Candidate): Promise<PortfolioAsset | null> {
  const coin = candidate.contract
    ? await coinGecko(`/coins/ethereum/contract/${candidate.contract}`)
    : await coinGecko("/coins/ethereum?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false");

  const athPrice = coin?.market_data?.ath?.usd;
  if (!coin || !athPrice || !Number.isFinite(athPrice)) return null;

  const currentPrice = coin.market_data?.current_price?.usd || candidate.currentPrice || 0;
  if (!currentPrice) return null;

  return {
    id: coin.id || candidate.id,
    name: candidate.name || coin.name,
    symbol: candidate.symbol.toUpperCase(),
    amount: candidate.amount,
    image: coin.image?.small || candidate.image,
    currentPrice,
    athPrice: Math.max(athPrice, currentPrice),
    athDate: coin.market_data?.ath_date?.usd || null,
    currentValue: candidate.amount * currentPrice,
    athValue: candidate.amount * Math.max(athPrice, currentPrice),
  };
}

export async function getPortfolio(address: string): Promise<PortfolioResponse> {
  const [account, balances, stats] = await Promise.all([
    blockscout<BlockscoutAddress>(`/addresses/${address}`),
    blockscout<BlockscoutTokenPage>(`/addresses/${address}/tokens?type=ERC-20`),
    blockscout<BlockscoutStats>("/stats"),
  ]);

  const nativeAmount = parseUnits(account.coin_balance || "0", 18);
  const nativePrice = Number(stats.coin_price || 0);
  const candidates: Candidate[] = [];

  if (nativeAmount > 0 && nativePrice > 0) {
    candidates.push({
      id: "ethereum",
      contract: null,
      name: "Ethereum",
      symbol: "ETH",
      amount: nativeAmount,
      currentPrice: nativePrice,
      image: null,
    });
  }

  const erc20s = balances.items
    .filter(({ token }) => token.type === "ERC-20" && token.decimals && token.exchange_rate)
    .map(({ token, value }) => {
      const amount = parseUnits(value, Number(token.decimals));
      const currentPrice = Number(token.exchange_rate || 0);
      return {
        id: token.address_hash.toLowerCase(),
        contract: token.address_hash.toLowerCase(),
        name: token.name,
        symbol: token.symbol,
        amount,
        currentPrice,
        image: token.icon_url,
      } satisfies Candidate;
    })
    .filter((token) => Number.isFinite(token.currentPrice) && token.amount * token.currentPrice >= 0.5)
    .sort((a, b) => b.amount * b.currentPrice - a.amount * a.currentPrice);

  const eligibleAssets = candidates.length + erc20s.length;
  candidates.push(...erc20s.slice(0, MAX_ERC20_LOOKUPS));

  const enriched = (await Promise.all(candidates.map(enrich))).filter((asset): asset is PortfolioAsset => Boolean(asset));
  enriched.sort((a, b) => b.currentValue - a.currentValue);

  if (!enriched.length) {
    throw new Error("We found the wallet, but none of its priced tokens have usable ATH data.");
  }

  const current = enriched.reduce((sum, asset) => sum + asset.currentValue, 0);
  const ath = enriched.reduce((sum, asset) => sum + asset.athValue, 0);
  const omitted = Math.max(0, eligibleAssets - enriched.length);

  return {
    address,
    source: { kind: "wallet", provider: "ethereum", label: "Ethereum wallet" },
    fetchedAt: new Date().toISOString(),
    totals: {
      current,
      ath,
      upside: Math.max(0, ath - current),
      multiplier: current > 0 ? ath / current : 0,
      matchedAssets: enriched.length,
      eligibleAssets,
    },
    assets: enriched,
    note: `Ethereum only. Based on ${enriched.length} token${enriched.length === 1 ? "" : "s"} with verified CoinGecko ATH data${omitted ? `; ${omitted} smaller or unmatched asset${omitted === 1 ? " was" : "s were"} left out` : ""}. Values are USD estimates, and token ATHs did not happen at the same time.`,
  };
}
