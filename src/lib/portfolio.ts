import type { PortfolioAsset, PortfolioResponse } from "./types";

const BLOCKSCOUT = "https://eth.blockscout.com/api/v2";
const COINGECKO = "https://api.coingecko.com/api/v3";
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";
const DEXSCREENER = "https://api.dexscreener.com/tokens/v1/solana";
const MAX_ERC20_LOOKUPS = 9;
const MAX_SOLANA_LOOKUPS = 9;
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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
  chain: string;
  platform: string;
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
    ? await coinGecko(`/coins/${candidate.platform}/contract/${candidate.contract}`)
    : await coinGecko(`/coins/${candidate.id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);

  const athPrice = coin?.market_data?.ath?.usd;
  if (!coin || !athPrice || !Number.isFinite(athPrice)) return null;

  const currentPrice = coin.market_data?.current_price?.usd || candidate.currentPrice || 0;
  if (!currentPrice) return null;

  return {
    id: coin.id || candidate.id,
    chain: candidate.chain,
    name: candidate.name || coin.name,
    symbol: (candidate.symbol || coin.symbol).toUpperCase(),
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
      chain: "Ethereum",
      platform: "ethereum",
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
        chain: "Ethereum",
        platform: "ethereum",
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
  const stablecoins: Record<string, number> = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1,
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1,
  };
  try {
    const response = await fetch(`${DEXSCREENER}/${mints.slice(0, 30).join(",")}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 5 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return stablecoins;
    const pairs = await response.json() as DexScreenerPair[];
    const bestLiquidity = new Map<string, number>();
    for (const pair of pairs) {
      const mint = pair.baseToken?.address;
      const value = Number(pair.priceUsd || 0);
      const liquidity = Number(pair.liquidity?.usd || 0);
      if (!mint || !Number.isFinite(value) || value <= 0 || liquidity <= (bestLiquidity.get(mint) || -1)) continue;
      stablecoins[mint] = value;
      bestLiquidity.set(mint, liquidity);
    }
    return stablecoins;
  } catch {
    return stablecoins;
  }
}

async function getSolanaPortfolio(address: string): Promise<PortfolioResponse> {
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

  const enriched = (await Promise.all(candidates.map(enrich))).filter((asset): asset is PortfolioAsset => Boolean(asset));
  if (!enriched.length) throw new Error("We found the Solana account, but none of its priced assets have usable ATH data.");
  enriched.sort((a, b) => b.currentValue - a.currentValue);
  return buildWalletResponse(address, "solana", "Solana", enriched, candidates.length, "Solana");
}

async function getHyperEvmPortfolio(address: string): Promise<PortfolioResponse | null> {
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
  const asset = await enrich({ id: "hyperliquid", chain: "HyperEVM", platform: "hyperevm", contract: null, name: "Hyperliquid", symbol: "HYPE", amount, currentPrice: 0, image: null });
  if (!asset) return null;
  return buildWalletResponse(address, "hyperevm", "HyperEVM", [asset], 1, "HyperEVM");
}

function buildWalletResponse(address: string, provider: string, label: string, assets: PortfolioAsset[], eligibleAssets: number, scope: string): PortfolioResponse {
  const current = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const ath = assets.reduce((sum, asset) => sum + asset.athValue, 0);
  return {
    address,
    source: { kind: "wallet", provider, label },
    fetchedAt: new Date().toISOString(),
    totals: { current, ath, upside: Math.max(0, ath - current), multiplier: current > 0 ? ath / current : 0, matchedAssets: assets.length, eligibleAssets },
    assets,
    note: `${scope}. Based on ${assets.length} asset${assets.length === 1 ? "" : "s"} with verified CoinGecko ATH data.`,
  };
}

export async function getConnectedPortfolio(addresses: { ethereum?: string; solana?: string }): Promise<PortfolioResponse> {
  const tasks: Promise<PortfolioResponse | null>[] = [];
  if (addresses.ethereum) {
    tasks.push(getPortfolio(addresses.ethereum));
    tasks.push(getHyperEvmPortfolio(addresses.ethereum));
  }
  if (addresses.solana) tasks.push(getSolanaPortfolio(addresses.solana));

  const settled = await Promise.allSettled(tasks);
  const portfolios = settled
    .filter((item): item is PromiseFulfilledResult<PortfolioResponse | null> => item.status === "fulfilled")
    .map((item) => item.value)
    .filter((item): item is PortfolioResponse => Boolean(item));
  if (!portfolios.length) {
    const failed = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
    throw failed?.reason instanceof Error ? failed.reason : new Error("We couldn’t find supported assets in this wallet.");
  }

  const assets = portfolios.flatMap((portfolio) => portfolio.assets).sort((a, b) => b.currentValue - a.currentValue);
  const current = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const ath = assets.reduce((sum, asset) => sum + asset.athValue, 0);
  const loadedChains = [...new Set(assets.map((asset) => asset.chain).filter(Boolean))];
  const partialFailures = settled.filter((item) => item.status === "rejected").length;
  return {
    address: addresses.ethereum || addresses.solana || "",
    addresses,
    source: { kind: "wallet", provider: "multichain", label: "Browser wallet" },
    fetchedAt: new Date().toISOString(),
    totals: {
      current,
      ath,
      upside: Math.max(0, ath - current),
      multiplier: current > 0 ? ath / current : 0,
      matchedAssets: assets.length,
      eligibleAssets: portfolios.reduce((sum, portfolio) => sum + portfolio.totals.eligibleAssets, 0),
    },
    assets,
    note: `${loadedChains.join(" + ")} included${partialFailures ? "; one supported network could not be read" : ""}. Based on ${assets.length} asset${assets.length === 1 ? "" : "s"} with verified CoinGecko ATH data. Values are USD estimates, and asset ATHs did not happen at the same time.`,
  };
}
