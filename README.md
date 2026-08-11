# ATH, Again

A small, emotionally unhelpful crypto calculator: what would your current portfolio be worth if every held asset returned to its all-time high?

## Sources

- Bitvavo spot and available staking balances through a one-time read-only API request.
- Binance spot balances through a one-time read-only API request.
- Public Ethereum addresses through Blockscout, pasted directly or discovered through any injected EIP-1193 wallet.
- Current prices and historical USD ATH data through CoinGecko.

API credentials are used in request memory and are not stored. Create read-only keys without trading or withdrawal permissions.

## Run locally

```bash
npm install
npm run dev
```

`COINGECKO_DEMO_API_KEY` is optional for local experiments but recommended for predictable free-tier limits.

See [docs/architecture.md](docs/architecture.md) for adapter boundaries, credential handling, demand tracking, pricing caveats, and the wallet-standard multichain path.

## Disclaimer

This is entertainment, not financial advice. “At every ATH” is a counterfactual sum: those highs occurred on different dates and could not necessarily have been realized together.
