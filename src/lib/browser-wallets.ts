import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import type { ConnectedAddresses } from "./portfolio";

type Eip1193Provider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type Eip6963Provider = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider };
type StandardConnect = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> };

export type BrowserWallet = {
  id: string;
  name: string;
  evm?: Eip6963Provider;
  solana?: Wallet;
};

export async function discoverInjectedWallets(): Promise<BrowserWallet[]> {
  const evmProviders = new Map<string, Eip6963Provider>();
  const receiveProvider = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Provider>).detail;
    if (detail?.info?.uuid && detail.provider) evmProviders.set(detail.info.uuid, detail);
  };

  window.addEventListener("eip6963:announceProvider", receiveProvider);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const standardWallets = getWallets();
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  window.removeEventListener("eip6963:announceProvider", receiveProvider);

  const merged = new Map<string, BrowserWallet>();
  for (const detail of evmProviders.values()) {
    const key = detail.info.name.trim().toLowerCase();
    merged.set(key, { id: `evm:${detail.info.uuid}`, name: detail.info.name, evm: detail });
  }
  for (const wallet of standardWallets.get()) {
    if (!wallet.chains.some((chain) => chain.startsWith("solana:"))) continue;
    if (!("standard:connect" in wallet.features)) continue;
    const key = wallet.name.trim().toLowerCase();
    const existing = merged.get(key);
    merged.set(key, { id: existing?.id || `solana:${wallet.name}`, name: wallet.name, evm: existing?.evm, solana: wallet });
  }
  return [...merged.values()].sort((a, b) => Number(Boolean(b.evm && b.solana)) - Number(Boolean(a.evm && a.solana)) || a.name.localeCompare(b.name));
}

export async function connectBrowserWallet(wallet: BrowserWallet): Promise<ConnectedAddresses> {
  const addresses: ConnectedAddresses = {};
  const connectionErrors: Error[] = [];

  if (wallet.evm) {
    try {
      const accounts = await wallet.evm.provider.request({ method: "eth_requestAccounts" }) as string[];
      addresses.ethereum = accounts[0];
    } catch (caught) {
      connectionErrors.push(caught instanceof Error ? caught : new Error("The EVM account was not shared."));
    }
  }
  if (wallet.solana) {
    try {
      const feature = wallet.solana.features["standard:connect"] as StandardConnect;
      const connected = await feature.connect();
      addresses.solana = connected.accounts.find((account) => account.chains.some((chain) => chain.startsWith("solana:")))?.address;
    } catch (caught) {
      connectionErrors.push(caught instanceof Error ? caught : new Error("The Solana account was not shared."));
    }
  }

  if (!addresses.ethereum && !addresses.solana) {
    throw connectionErrors[0] || new Error("No supported account was shared by the wallet.");
  }
  return addresses;
}
