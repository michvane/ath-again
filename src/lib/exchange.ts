import { createHmac } from "node:crypto";
import type { PortfolioAsset, PortfolioResponse } from "./types";
import { summarizeAssets } from "./portfolio/core";

const BITVAVO_API = "https://api.bitvavo.com/v2";
const BINANCE_API = "https://api.binance.com";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const FIAT_SYMBOLS = new Set(["EUR", "USD", "GBP", "CHF"]);
const MAX_ASSETS = 50;

export type ExchangeName = "bitvavo" | "binance";

type ExchangeBalance = { symbol: string; amount: number };
type BitvavoBalance = { symbol: string; available?: string; inOrder?: string; amount?: string };
type BinanceAccount = { balances?: Array<{ asset: string; free: string; locked: string }> };
type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  current_price: number | null;
  ath: number | null;
  ath_date: string | null;
  market_cap_rank: number | null;
};

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function readJson<T>(response: Response, provider: string): Promise<T> {
  const body = await response.json().catch(() => null) as T | { error?: string; msg?: string; message?: string } | null;
  if (response.ok) return body as T;

  const upstream = body && typeof body === "object"
    ? ("error" in body && body.error) || ("msg" in body && body.msg) || ("message" in body && body.message)
    : null;
  const detail = typeof upstream === "string" ? ` ${upstream}` : "";
  throw new Error(`${provider} rejected the read-only connection.${detail}`);
}

async function bitvavoRequest<T>(path: string, apiKey: string, secret: string): Promise<T> {
  const timestamp = Date.now().toString();
  const fullPath = `/v2${path}`;
  const signature = hmac(secret, `${timestamp}GET${fullPath}`);
  const response = await fetch(`${BITVAVO_API}${path}`, {
    headers: {
      Accept: "application/json",
      "Bitvavo-Access-Key": apiKey,
      "Bitvavo-Access-Timestamp": timestamp,
      "Bitvavo-Access-Signature": signature,
      "Bitvavo-Access-Window": "10000",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  return readJson<T>(response, "Bitvavo");
}

async function getBitvavoBalances(apiKey: string, secret: string): Promise<ExchangeBalance[]> {
  const [spot, staking] = await Promise.all([
    bitvavoRequest<BitvavoBalance[]>("/balance", apiKey, secret),
    bitvavoRequest<BitvavoBalance[]>("/stakingBalance", apiKey, secret).catch(() => []),
  ]);
  const totals = new Map<string, number>();

  for (const balance of spot) {
    const amount = Number(balance.available || 0) + Number(balance.inOrder || 0);
    if (amount > 0) totals.set(balance.symbol, (totals.get(balance.symbol) || 0) + amount);
  }
  for (const balance of staking) {
    const amount = Number(balance.amount || 0);
    if (amount > 0) totals.set(balance.symbol, (totals.get(balance.symbol) || 0) + amount);
  }
  return Array.from(totals, ([symbol, amount]) => ({ symbol, amount }));
}

async function getBinanceBalances(apiKey: string, secret: string): Promise<ExchangeBalance[]> {
  const query = `timestamp=${Date.now()}&recvWindow=5000`;
  const signature = hmac(secret, query);
  const response = await fetch(`${BINANCE_API}/api/v3/account?${query}&signature=${signature}`, {
    headers: { Accept: "application/json", "X-MBX-APIKEY": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const account = await readJson<BinanceAccount>(response, "Binance");
  return (account.balances || [])
    .map(({ asset, free, locked }) => ({ symbol: asset, amount: Number(free) + Number(locked) }))
    .filter(({ amount }) => Number.isFinite(amount) && amount > 0);
}

async function getMarketData(symbols: string[]): Promise<CoinGeckoMarket[]> {
  if (!symbols.length) return [];
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_DEMO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_DEMO_API_KEY;
  const params = new URLSearchParams({
    vs_currency: "usd",
    symbols: symbols.join(",").toLowerCase(),
    include_tokens: "top",
    per_page: "250",
    sparkline: "false",
  });
  const response = await fetch(`${COINGECKO_API}/coins/markets?${params}`, {
    headers,
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Price history is taking a coffee break. Try again shortly.");
  return response.json() as Promise<CoinGeckoMarket[]>;
}

function buildResponse(exchange: ExchangeName, balances: ExchangeBalance[], markets: CoinGeckoMarket[]): PortfolioResponse {
  const bestMarket = new Map<string, CoinGeckoMarket>();
  for (const market of markets) {
    const symbol = market.symbol.toUpperCase();
    const current = bestMarket.get(symbol);
    if (!current || (market.market_cap_rank || Infinity) < (current.market_cap_rank || Infinity)) bestMarket.set(symbol, market);
  }

  const eligible = balances.filter(({ symbol }) => !FIAT_SYMBOLS.has(symbol.toUpperCase()));
  const assets: PortfolioAsset[] = eligible.flatMap(({ symbol, amount }) => {
    const market = bestMarket.get(symbol.toUpperCase());
    if (!market?.current_price || !market.ath || !Number.isFinite(amount)) return [];
    const athPrice = Math.max(market.ath, market.current_price);
    return [{
      id: market.id,
      name: market.name,
      symbol: symbol.toUpperCase(),
      amount,
      image: market.image,
      currentPrice: market.current_price,
      athPrice,
      athDate: market.ath_date,
      currentValue: amount * market.current_price,
      athValue: amount * athPrice,
    }];
  }).filter((asset) => asset.currentValue >= 0.5).sort((a, b) => b.currentValue - a.currentValue);

  if (!assets.length) throw new Error("The exchange connected, but none of its balances matched usable ATH data.");
  const provider = exchange === "bitvavo" ? "Bitvavo" : "Binance";
  const omitted = Math.max(0, eligible.length - assets.length);

  return {
    address: exchange,
    source: { kind: "exchange", provider: exchange, label: `${provider} account` },
    fetchedAt: new Date().toISOString(),
    totals: summarizeAssets(assets, eligible.length),
    assets,
    note: `Read-only ${provider} snapshot. ${assets.length} asset${assets.length === 1 ? "" : "s"} matched to the highest-market-cap CoinGecko asset with that symbol${omitted ? `; ${omitted} fiat, dust, or unmatched balance${omitted === 1 ? " was" : "s were"} left out` : ""}. Credentials were used for this request only and were not stored.`,
  };
}

export async function getExchangePortfolio(exchange: ExchangeName, apiKey: string, secret: string): Promise<PortfolioResponse> {
  const balances = exchange === "bitvavo"
    ? await getBitvavoBalances(apiKey, secret)
    : await getBinanceBalances(apiKey, secret);
  const symbols = balances
    .map(({ symbol }) => symbol.toUpperCase())
    .filter((symbol) => !FIAT_SYMBOLS.has(symbol))
    .slice(0, MAX_ASSETS);
  const markets = await getMarketData(symbols);
  return buildResponse(exchange, balances.slice(0, MAX_ASSETS), markets);
}
