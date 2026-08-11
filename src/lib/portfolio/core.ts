import type { PortfolioAsset, PortfolioResponse } from "../types";

const COINGECKO = "https://api.coingecko.com/api/v3";

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

export type Candidate = {
  id: string;
  chain: string;
  platform: string;
  contract: string | null;
  name: string;
  symbol: string;
  amount: number;
  currentPrice: number;
  image: string | null;
};

export function parseUnits(raw: string, decimals: number): number {
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

async function coinGecko(path: string): Promise<CoinGeckoCoin | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_DEMO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_DEMO_API_KEY;

  try {
    const response = await fetch(`${COINGECKO}${path}`, {
      headers,
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return response.json() as Promise<CoinGeckoCoin>;
  } catch {
    return null;
  }
}

export async function enrichCandidate(candidate: Candidate): Promise<PortfolioAsset | null> {
  const coin = candidate.contract
    ? await coinGecko(`/coins/${candidate.platform}/contract/${candidate.contract}`)
    : await coinGecko(`/coins/${candidate.id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
  const athPrice = coin?.market_data?.ath?.usd;
  if (!coin || !athPrice || !Number.isFinite(athPrice)) return null;

  const currentPrice = coin.market_data?.current_price?.usd || candidate.currentPrice || 0;
  if (!currentPrice) return null;
  const protectedAth = Math.max(athPrice, currentPrice);

  return {
    id: coin.id || candidate.id,
    chain: candidate.chain,
    name: candidate.name || coin.name,
    symbol: (candidate.symbol || coin.symbol).toUpperCase(),
    amount: candidate.amount,
    image: coin.image?.small || candidate.image,
    currentPrice,
    athPrice: protectedAth,
    athDate: coin.market_data?.ath_date?.usd || null,
    currentValue: candidate.amount * currentPrice,
    athValue: candidate.amount * protectedAth,
  };
}

export function summarizeAssets(assets: PortfolioAsset[], eligibleAssets = assets.length) {
  const current = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const ath = assets.reduce((sum, asset) => sum + asset.athValue, 0);
  return {
    current,
    ath,
    upside: Math.max(0, ath - current),
    multiplier: current > 0 ? ath / current : 0,
    matchedAssets: assets.length,
    eligibleAssets,
  };
}

export function buildWalletResponse(
  address: string,
  provider: string,
  label: string,
  assets: PortfolioAsset[],
  eligibleAssets: number,
  note: string,
): PortfolioResponse {
  return {
    address,
    source: { kind: "wallet", provider, label },
    fetchedAt: new Date().toISOString(),
    totals: summarizeAssets(assets, eligibleAssets),
    assets,
    note,
  };
}
