import type { PortfolioResponse } from "./types";
import { summarizeAssets } from "./portfolio/core";
import { getEthereumPortfolio } from "./portfolio/ethereum";
import { getHyperEvmPortfolio } from "./portfolio/hyperevm";
import { getSolanaPortfolio } from "./portfolio/solana";

export type ConnectedAddresses = {
  ethereum?: string;
  solana?: string;
};

export async function getConnectedPortfolio(addresses: ConnectedAddresses): Promise<PortfolioResponse> {
  const tasks: Promise<PortfolioResponse | null>[] = [];
  if (addresses.ethereum) {
    tasks.push(getEthereumPortfolio(addresses.ethereum));
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
  const loadedChains = [...new Set(assets.map((asset) => asset.chain).filter(Boolean))];
  const partialFailures = settled.filter((item) => item.status === "rejected").length;
  const eligibleAssets = portfolios.reduce((sum, portfolio) => sum + portfolio.totals.eligibleAssets, 0);

  return {
    address: addresses.ethereum || addresses.solana || "",
    addresses,
    source: { kind: "wallet", provider: "multichain", label: "Browser wallet" },
    fetchedAt: new Date().toISOString(),
    totals: summarizeAssets(assets, eligibleAssets),
    assets,
    note: `${loadedChains.join(" + ")} included${partialFailures ? "; one supported network could not be read" : ""}. Based on ${assets.length} asset${assets.length === 1 ? "" : "s"} with verified CoinGecko ATH data. Values are USD estimates, and asset ATHs did not happen at the same time.`,
  };
}
