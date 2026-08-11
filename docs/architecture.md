# System design

## Product boundary

ATH, Again is a stateless, read-only portfolio calculator. The first-class sources are Bitvavo and Binance exchange balances, followed by public EVM wallets. The app never trades, withdraws, signs a transaction, stores an API credential, or requests a seed phrase or private key.

Exchange credentials are submitted over HTTPS to a Node.js route, held only in request memory, used to sign one balance lookup, and discarded when the request ends. Users must create a key with read permissions only. Persistent account linking would require authentication, encrypted secret storage, rotation and revocation UX, and is intentionally outside this prototype.

## Request flow

```text
Browser
  ├── Bitvavo/Binance read-only API key + secret
  └── public EVM address
             │
             ▼
Next.js routes on Vercel
  ├── exchange adapter: sign request and normalize spot/staking balances
  ├── EVM adapter: Blockscout ETH + ERC-20 balances
  └── CoinGecko: current USD price, ATH and ATH date
             │
             ▼
Normalized PortfolioResponse → counterfactual ATH result
```

The exchange API route deliberately logs only the provider, timing, request ID and matched asset count. Credentials and request bodies never enter application logs or analytics.

## Provider-independent adapters

The core boundary is a portfolio source, not a wallet brand. Every adapter produces the same normalized asset shape:

```ts
type Holding = {
  symbol: string
  amount: number
  canonicalId?: string
}
```

- Exchange adapters authenticate against a venue and return its off-chain balances.
- EVM adapters accept an EIP-1193 address regardless of whether MetaMask, Rabby, Coinbase Wallet or Phantom exposed it.
- Future Solana support should use Wallet Standard and public addresses rather than a Phantom-only foundation.
- Future Bitcoin support should accept public addresses/descriptors and use a UTXO indexer.

Wallet connection is only address discovery. Portfolio discovery remains chain-specific because EVM token contracts, Solana token accounts and Bitcoin UTXOs use different data models.

## Current integrations

### Bitvavo

`GET /v2/balance` supplies available and in-order spot balances. The adapter also attempts `GET /v2/stakingBalance`; unsupported or unpermitted staking reads do not fail the spot portfolio. Requests use Bitvavo's timestamped HMAC-SHA256 headers.

### Binance

`GET /api/v3/account` supplies free and locked spot balances. Requests use Binance's HMAC-SHA256 signed query and a `USER_DATA` API key. Trading permissions are unnecessary.

### EVM wallets

Pasted addresses and injected EIP-1193 providers share the existing Blockscout adapter. It is wallet-brand agnostic but currently indexes Ethereum only.

## Pricing and identity

Exchange balances expose symbols, not chain contract identifiers. The prototype queries CoinGecko markets for those symbols and selects the highest-market-cap match. This is practical for common assets but not tax-grade identity resolution; ambiguous or unmatched assets are disclosed in the result note.

For every matched asset:

```text
current value = amount × current USD price
ATH value     = amount × max(historical USD ATH, current USD price)
portfolio ATH = Σ ATH value
```

Fiat, dust below $0.50 and unmatched assets are omitted. Token highs occurred on different dates, so the total is intentionally counterfactual rather than a historical portfolio snapshot.

## Demand tracking

Coming-soon clicks emit the anonymous Vercel Web Analytics event `connector_interest` with one property, `connector`. The same selection is written as a credential-free structured runtime log so interest remains observable when custom event reporting is unavailable on the current Vercel plan.

## Security follow-ups before wider use

- Add per-IP rate limiting and bot protection to credential and public-wallet routes.
- Review exchange key IP allowlisting; dynamic serverless egress may require static egress infrastructure.
- Add explicit request-size limits at the platform layer.
- Never add trade or withdrawal endpoints to the credential-bearing adapter.
- If persistent linking is added, require user authentication and envelope encryption backed by managed KMS.
- Replace symbol-only matching with exchange asset metadata plus a curated canonical-ID registry.
