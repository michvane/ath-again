"use client";

import { FormEvent, useState } from "react";
import { track } from "@vercel/analytics";
import type { PortfolioResponse } from "@/lib/types";

type Source = "bitvavo" | "binance" | "wallet";
type FutureConnector = "solana" | "bitcoin" | "kraken" | "coinbase" | "tron";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const sourceNames: Record<Source, string> = { bitvavo: "Bitvavo", binance: "Binance", wallet: "EVM wallet" };
const futureConnectors: Array<{ id: FutureConnector; name: string; detail: string }> = [
  { id: "solana", name: "Solana", detail: "Wallet Standard" },
  { id: "bitcoin", name: "Bitcoin", detail: "Public addresses" },
  { id: "kraken", name: "Kraken", detail: "Read-only API" },
  { id: "coinbase", name: "Coinbase", detail: "Exchange account" },
  { id: "tron", name: "Tron", detail: "Public addresses" },
];

function formatPrice(value: number) {
  if (value >= 0.01) return price.format(value);
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 10 })}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCalculator() {
  const [source, setSource] = useState<Source>("bitvavo");
  const [address, setAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function chooseSource(next: Source) {
    setSource(next);
    setResult(null);
    setError("");
    setInterestMessage("");
  }

  async function requestPortfolio(endpoint: string, body: Record<string, string>) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.error || "That portfolio refused to reveal its alternate timeline.");
      setResult(responseBody);
      requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (source === "wallet") {
      await requestPortfolio("/api/portfolio", { address: address.trim() });
      return;
    }

    await requestPortfolio("/api/exchange", { exchange: source, apiKey: apiKey.trim(), secret: secret.trim() });
    setApiKey("");
    setSecret("");
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError("No EVM browser wallet found. Paste its public 0x address instead.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const connected = accounts[0];
      if (!connected) throw new Error("No account was shared by the wallet.");
      setAddress(connected);
      await requestPortfolio("/api/portfolio", { address: connected });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection was cancelled.");
    }
  }

  function registerInterest(connector: FutureConnector, name: string) {
    track("connector_interest", { connector });
    void fetch("/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector }),
      keepalive: true,
    });
    setInterestMessage(`${name} got your vote. We’ll use these clicks to choose what ships next.`);
  }

  const exchange = source !== "wallet";
  const provider = sourceNames[source];

  return (
    <div className="calculator">
      <section className="source-picker" aria-labelledby="source-heading">
        <div className="source-intro">
          <span className="eyebrow">Choose where the damage lives</span>
          <h2 id="source-heading">Start with your actual portfolio.</h2>
        </div>
        <div className="source-tabs" role="group" aria-label="Portfolio source">
          {(["bitvavo", "binance", "wallet"] as Source[]).map((item) => (
            <button
              key={item}
              className={`source-tab ${source === item ? "selected" : ""}`}
              type="button"
              aria-pressed={source === item}
              onClick={() => chooseSource(item)}
            >
              <span className={`source-logo ${item}`}>{item === "bitvavo" ? "B" : item === "binance" ? "◆" : "↗"}</span>
              <span>{sourceNames[item]}<small>{item === "wallet" ? "Public EVM address" : "Read-only API"}</small></span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={onSubmit} aria-label={`${provider} portfolio calculator`}>
        <div className="form-topline">
          <span>{exchange ? `Connect ${provider}` : "Check a public wallet"}</span>
          <span className="network-status"><i /> {exchange ? "One-time read" : "Ethereum · live"}</span>
        </div>

        {exchange ? (
          <>
            <div className="credential-grid">
              <label>
                <span>API key</span>
                <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" spellCheck={false} required />
              </label>
              <label>
                <span>API secret</span>
                <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="new-password" required />
              </label>
              <button className="submit-button" disabled={loading} type="submit">
                {loading ? "Reading balances…" : "Connect & calculate →"}
              </button>
            </div>
            <div className="credential-note">
              <span className="shield" aria-hidden="true">✓</span>
              <p><strong>Read-only keys only.</strong> Credentials are sent over HTTPS, used once on the server, then discarded. Never enable trading or withdrawals.</p>
              <a href={source === "bitvavo" ? "https://docs.bitvavo.com/docs/get-started/" : "https://www.binance.com/en/my/settings/api-management"} target="_blank" rel="noreferrer">How to create one ↗</a>
            </div>
          </>
        ) : (
          <>
            <div className="entry-panel">
              <label htmlFor="wallet-address" className="sr-only">Ethereum wallet address</label>
              <input
                id="wallet-address"
                className="address-input"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Paste an Ethereum 0x address"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button className="submit-button" disabled={loading} type="submit">
                {loading ? "Calculating…" : "Let me suffer →"}
              </button>
            </div>
            <div className="connect-row">
              <button className="wallet-button" disabled={loading} type="button" onClick={connectWallet}>Connect any EVM wallet</button>
              <span className="privacy-note">MetaMask, Rabby, Phantom EVM, and compatible providers.</span>
            </div>
          </>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>

      <section className="coming-soon" aria-labelledby="coming-soon-heading">
        <div>
          <span className="eyebrow">Next up</span>
          <h3 id="coming-soon-heading">What should we connect next?</h3>
          <p>Tap one. The most wanted source moves up the list.</p>
        </div>
        <div className="future-grid">
          {futureConnectors.map((connector) => (
            <button key={connector.id} type="button" onClick={() => registerInterest(connector.id, connector.name)}>
              <span>{connector.name}<small>{connector.detail}</small></span>
              <i>Coming soon</i>
            </button>
          ))}
        </div>
        <p className="interest-message" aria-live="polite">{interestMessage}</p>
      </section>

      {loading ? (
        <div className="loading" aria-live="polite">
          <div className="loading-line" />
          <p>Finding the version of you who sold the top…</p>
        </div>
      ) : null}

      {result ? (
        <section className="results" id="results" aria-live="polite">
          <div className="results-header">
            <div>
              <p className="kicker">THE PAINFUL TRUTH FOR {result.source.kind === "wallet" ? shortAddress(result.address) : result.source.label.toUpperCase()}</p>
              <h2>Your alternate timeline.</h2>
            </div>
            <button className="try-again" onClick={() => setResult(null)}>Try another source</button>
          </div>

          <div className="result-grid">
            <article className="result-card">
              <span className="result-label">Tracked today</span>
              <strong className="result-value">{money.format(result.totals.current)}</strong>
              <span className="result-caption">Reality. Unnecessarily specific.</span>
            </article>
            <article className="result-card dream">
              <span className="result-label">At every ATH</span>
              <strong className="result-value">{money.format(result.totals.ath)}</strong>
              <span className="result-caption">A beautiful, impossible coincidence.</span>
            </article>
            <article className="result-card pain">
              <span className="result-label">Pain multiplier</span>
              <strong className="result-value">{result.totals.multiplier.toFixed(1)}×</strong>
              <span className="result-caption">That’s {money.format(result.totals.upside)} in character development.</span>
            </article>
          </div>

          <p className="coverage">{result.note}</p>

          <div className="asset-table" role="table" aria-label="Portfolio assets">
            <div className="asset-row table-head" role="row">
              <span>Asset</span><span>Holdings</span><span>Price now</span><span>ATH value</span>
            </div>
            {result.assets.map((asset) => (
              <div className="asset-row" role="row" key={asset.id}>
                <div className="token" role="cell">
                  <span className="token-icon">{asset.symbol.slice(0, 2)}</span>
                  <span className="token-name">{asset.name}<small className="token-symbol">{asset.symbol}</small></span>
                </div>
                <span className="number" role="cell"><i className="mobile-label">Holdings</i>{quantity.format(asset.amount)}</span>
                <span className="number" role="cell"><i className="mobile-label">Price now</i>{formatPrice(asset.currentPrice)}</span>
                <strong className="number" role="cell"><i className="mobile-label">ATH value</i>{money.format(asset.athValue)}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
  }
}
