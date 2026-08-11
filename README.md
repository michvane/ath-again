# ATH, Again

A small, read-only Ethereum wallet app that answers one emotionally unhelpful question: what would this wallet be worth if every held token returned to its all-time high?

## What it does

- Accepts a pasted Ethereum address or an injected browser wallet connection.
- Reads native ETH and ERC-20 balances from Blockscout.
- Matches meaningful holdings to CoinGecko market data.
- Compares the tracked value today with the sum at each token's historical USD ATH.
- Never requests a signature or transaction.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The CoinGecko key is optional for local experiments but recommended for predictable free-tier limits.

## Product scope

Version one deliberately supports Ethereum only and prices the largest nine ERC-20 balances plus native ETH. This keeps the first result fast, filters most wallet spam, and stays friendly to free API limits. See [docs/architecture.md](docs/architecture.md) for the provider choices, privacy model, caching strategy, failure modes, and multichain path.

## Disclaimer

This is an entertainment calculator, not financial advice. “At every ATH” is a counterfactual sum: those highs occurred on different dates and could not necessarily have been realized together.
