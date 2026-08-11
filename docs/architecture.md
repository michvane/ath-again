# System architecture

## Product boundary

ATH, Again is a stateless, read-only portfolio calculator. It does not trade, withdraw, sign transactions, request private keys, or persist exchange credentials.

Browser wallet connection is only an address-discovery mechanism. Holdings are always read from public chain infrastructure. Exchange keys are submitted over HTTPS to a Node.js route, held in request memory for one signed balance request, and discarded when that request finishes.

## Runtime flow

```text
Browser
  ├── pasted Ethereum or Solana address
  ├── EIP-6963 + Wallet Standard discovered accounts
  └── one-time Bitvavo/Binance read-only credentials
                    │
                    ▼
Next.js Node.js route handlers
  ├── validate input and select source
  ├── run independent chain adapters concurrently
  └── tolerate partial chain-provider failure
                    │
                    ▼
Provider adapters
  ├── Ethereum: Blockscout ETH + ERC-20 balances
  ├── Solana: JSON-RPC SOL + SPL/Token-2022 balances
  ├── HyperEVM: JSON-RPC native HYPE balance
  ├── Bitvavo: HMAC-signed spot/staking requests
  └── Binance: HMAC-signed spot request
                    │
                    ▼
Market data
  ├── DEX Screener: batched Solana price discovery
  └── CoinGecko: canonical identity, current USD price and ATH
                    │
                    ▼
Normalized PortfolioResponse → client result view
```

## Code boundaries

```text
src/
  app/api/                  HTTP validation and response handling
  components/               interaction flow and normalized result UI
  lib/addresses.ts          pure address detection
  lib/browser-wallets.ts    EIP-6963 and Wallet Standard discovery
  lib/exchange.ts           authenticated exchange adapters
  lib/portfolio.ts          multichain orchestration
  lib/portfolio/
    core.ts                 pricing enrichment and portfolio math
    ethereum.ts             Ethereum/Blockscout adapter
    solana.ts               Solana RPC and DEX Screener adapter
    hyperevm.ts             HyperEVM native balance adapter
```

Every source normalizes into `PortfolioAsset` and `PortfolioResponse`. This keeps provider-specific fields out of UI components and makes new chain adapters additive.

## Wallet standards

EVM wallets are discovered with EIP-6963 and connected through EIP-1193. Solana wallets are discovered and connected through Wallet Standard. Entries with the same wallet name are presented as one choice, allowing a wallet such as Phantom to share both its EVM and Solana accounts without a Phantom-specific SDK.

## Pricing model

For every matched asset:

```text
current value = amount × current USD price
ATH value     = amount × max(historical USD ATH, current USD price)
portfolio ATH = Σ ATH value
```

The maximum protects the estimate when a live price exceeds CoinGecko's cached ATH. Dust below $0.50, unpriced tokens, and assets without usable ATH data are omitted and disclosed in the result note.

Exchange balances provide symbols rather than canonical contract identifiers. The exchange adapter selects the highest-market-cap CoinGecko match for each symbol, which is practical for a playful calculator but not suitable for accounting or tax use.

## Failure model

Independent wallet adapters run concurrently with `Promise.allSettled`. If one network provider fails while another succeeds, the app returns the available chains and discloses the partial failure. If every requested source fails, the most useful provider error is returned.

External requests have explicit timeouts. Market-data responses use bounded Next.js revalidation while account balances remain uncached.

## Security posture

- Public-wallet requests contain addresses only.
- Exchange request bodies are not logged or persisted.
- Credentials are cleared from client state after the request.
- Response headers disable framing, MIME sniffing, and unnecessary browser permissions.
- CI runs linting, unit tests, TypeScript compilation, and the production build.

Before wider use, add distributed rate limiting, bot protection, and static egress if exchange IP allowlisting becomes a requirement.
