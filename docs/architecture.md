# System design

## Goal and boundaries

ATH, Again is a stateless, read-only portfolio calculator. A user submits an Ethereum address by pasting it or sharing the active account from an injected browser wallet. The app never asks for a signature, transaction, private key, seed phrase, login, or write permission.

The MVP supports Ethereum native ETH and fungible ERC-20 balances. NFTs, LP positions, staked assets, lending positions, bridged representations without CoinGecko coverage, and unpriced tokens are out of scope. The UI says exactly how many assets contributed to the total.

## Request flow

```text
Browser
  │  POST public wallet address
  ▼
Next.js route on Vercel
  ├── Blockscout: ETH balance, ERC-20 balances, current USD prices
  ├── filter dust/spam and keep the largest balances
  └── CoinGecko: current price, USD ATH and ATH date by contract
  │
  ▼
Normalized portfolio + transparent coverage note
  │
  ▼
Browser renders current value, counterfactual ATH value and asset rows
```

## Why these providers

### Holdings: Blockscout

The public Blockscout v2 API exposes address information and paginated token balances without requiring the app to run an archive node or scan Transfer logs. Its token response includes decimals, contract addresses, icons and an exchange rate. The MVP requests only the first ERC-20 page instead of downloading a wallet's entire NFT and spam inventory. It is a strong zero-cost MVP dependency and is hidden behind one module so it can later be replaced with Alchemy, Moralis, GoldRush or Blockscout Pro.

The app intentionally does not use `web3.js`. Wallet connection only needs the EIP-1193 provider exposed by a browser wallet, while balance discovery requires an indexer rather than an RPC library. If contract reads are added later, `viem` is the smaller, typed modern choice.

### ATH data: CoinGecko Demo

CoinGecko returns `market_data.ath.usd` and `ath_date.usd` from a token's platform contract endpoint. The free Demo tier avoids a CoinMarketCap subscription. Contract lookups are cached for 24 hours because ATH values rarely change; current wallet balances are not cached in the browser or CDN. The app checks only the nine largest priced ERC-20 balances with an eight-second upstream timeout, which controls latency and API usage while excluding most wallet dust.

For a busier public launch, add a persistent contract-to-CoinGecko cache in Vercel Runtime Cache or Redis. A nightly job could refresh popular tokens and reduce nearly all request-time CoinGecko traffic.

## Calculation

For every matched asset:

```text
current value = token amount × current USD price
ATH value     = token amount × historical USD ATH price
portfolio ATH = Σ ATH value for all matched assets
```

The result is intentionally counterfactual. Each token reached its high on a different date. The app does not claim that the total was ever simultaneously realizable.

## Wallet connection

The MVP supports both paths with the same API call:

1. Paste any public `0x` address.
2. Use `eth_requestAccounts` against an injected EIP-1193 provider (MetaMask, Rabby, Coinbase Wallet extension, and similar).

There is no WalletConnect QR modal in v1, so there is no Reown project ID or extra client bundle. If mobile deep linking becomes important, add wagmi + Reown AppKit behind the existing `connectWallet` action. Connection still remains read-only.

## Privacy and security

- Wallet addresses are public blockchain identifiers, but the route uses POST and sets `private, no-store` so address-specific responses are not CDN cached or put in query strings.
- The CoinGecko key exists only in the server environment.
- Input is strictly validated as a 20-byte hex Ethereum address.
- No arbitrary RPC URL, chain, token contract, or upstream URL is accepted from the client.
- Upstream errors are converted to user-safe messages; API keys and raw provider payloads are never returned.
- Before a large public launch, add per-IP rate limiting and bot protection to prevent free-tier exhaustion.

## Scaling and multichain path

Keep the `PortfolioResponse` contract stable and add provider adapters:

1. Add a chain selector whose entries map to a fixed Blockscout instance and CoinGecko platform ID.
2. Normalize each chain's native asset and ERC-20 results into `Candidate` records.
3. Fetch chains concurrently with a bounded concurrency limit.
4. Deduplicate canonical assets only for display; never merge balances based on symbol alone.
5. Add Vercel Runtime Cache or Redis for contract mappings and ATH records, plus a short wallet snapshot cache if traffic demands it.

At larger scale, a multichain portfolio API is worth paying for because it handles spam classification, DeFi positions, token identity and pagination. The UI and calculation layer would not need to change.

## Known failure modes

- CoinGecko has no record for a contract: omit it and explain coverage.
- An API is rate-limited: return a retryable error rather than inventing a price.
- Blockscout exchange rates are stale: CoinGecko is preferred when its response is available, and the result is labeled an estimate.
- Rebasing, fee-on-transfer and proxy-migrated tokens: the indexer balance is accepted; unusual assets may be omitted.
- A wallet contains hundreds of airdrop tokens: only priced balances above $0.50 are eligible and only the largest nine ERC-20s are enriched.
