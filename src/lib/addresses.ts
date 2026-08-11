import type { ConnectedAddresses } from "./portfolio";

export const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectAddress(value: string): ConnectedAddresses | null {
  const address = value.trim();
  if (ETHEREUM_ADDRESS.test(address)) return { ethereum: address };
  if (SOLANA_ADDRESS.test(address)) return { solana: address };
  return null;
}
