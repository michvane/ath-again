"use client";

import { FormEvent, useState } from "react";
import type { PortfolioResponse } from "@/lib/types";

type Flow = "choose" | "paste" | "exchange" | "credentials";
type Exchange = "bitvavo" | "binance";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const exchangeNames: Record<Exchange, string> = { bitvavo: "Bitvavo", binance: "Binance" };

function formatPrice(value: number) {
  if (value >= 0.01) return price.format(value);
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 10 })}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCalculator() {
  const [flow, setFlow] = useState<Flow>("choose");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [address, setAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function navigate(next: Flow) {
    setFlow(next);
    setError("");
  }

  function reset() {
    setFlow("choose");
    setExchange(null);
    setAddress("");
    setApiKey("");
    setSecret("");
    setResult(null);
    setError("");
  }

  async function requestPortfolio(endpoint: string, body: Record<string, string>) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.error || "We couldn’t read that portfolio.");
      setResult(responseBody);
      requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitWallet(event: FormEvent) {
    event.preventDefault();
    await requestPortfolio("/api/portfolio", { address: address.trim() });
  }

  async function submitExchange(event: FormEvent) {
    event.preventDefault();
    if (!exchange) return;
    await requestPortfolio("/api/exchange", { exchange, apiKey: apiKey.trim(), secret: secret.trim() });
    setApiKey("");
    setSecret("");
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError("No compatible EVM wallet was found. You can paste its public address instead.");
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

  if (result) {
    const walletResult = result.source.kind === "wallet";
    return (
      <section className="results" id="results" aria-live="polite">
        <div className="results-heading">
          <div>
            <span className="overline">{walletResult ? `Ethereum · ${shortAddress(result.address)}` : result.source.label}</span>
            <h2>{walletResult ? "Your Ethereum ATH estimate" : "Your portfolio at all-time highs"}</h2>
          </div>
          <button className="text-button" type="button" onClick={reset}>Check another portfolio</button>
        </div>

        {walletResult ? (
          <div className="scope-note">
            <span>Ethereum only</span>
            <p>This is the subtotal for the connected Ethereum address. Phantom balances on Solana, HyperEVM, Bitcoin, Base, Polygon, and other networks are not included yet.</p>
          </div>
        ) : null}

        <div className="summary-grid">
          <article>
            <span>{walletResult ? "On Ethereum today" : "Value today"}</span>
            <strong>{money.format(result.totals.current)}</strong>
          </article>
          <article className="highlight">
            <span>If each asset hit ATH</span>
            <strong>{money.format(result.totals.ath)}</strong>
          </article>
          <article>
            <span>Potential increase</span>
            <strong>+{money.format(result.totals.upside)}</strong>
            <small>{result.totals.multiplier.toFixed(1)}× today’s value</small>
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
                <span className="token-name">{asset.name}<small>{asset.symbol}</small></span>
              </div>
              <span className="number" role="cell"><i>Holdings</i>{quantity.format(asset.amount)}</span>
              <span className="number" role="cell"><i>Price now</i>{formatPrice(asset.currentPrice)}</span>
              <strong className="number" role="cell"><i>ATH value</i>{money.format(asset.athValue)}</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flow-card" aria-live="polite">
      {flow === "choose" ? (
        <div className="flow-step">
          <h2>How do you want to check it?</h2>
          <div className="choice-list">
            <button type="button" onClick={() => navigate("paste")}>
              <span className="choice-icon paste" aria-hidden="true">⌁</span>
              <span><strong>Paste a wallet address</strong><small>Instant. No connection needed.</small></span>
              <i aria-hidden="true">→</i>
            </button>
            <button type="button" disabled={loading} onClick={connectWallet}>
              <span className="choice-icon browser" aria-hidden="true">↗</span>
              <span><strong>{loading ? "Connecting…" : "Connect an Ethereum wallet"}</strong><small>Reads the active Ethereum address only.</small></span>
              <i aria-hidden="true">→</i>
            </button>
            <button type="button" onClick={() => navigate("exchange")}>
              <span className="choice-icon exchange" aria-hidden="true">⇄</span>
              <span><strong>Connect an exchange</strong><small>Bitvavo or Binance.</small></span>
              <i aria-hidden="true">→</i>
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {flow === "paste" ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("choose")}>← Back</button>
          <h2>Paste a wallet address</h2>
          <p className="step-copy">Enter any public Ethereum 0x address. It doesn’t need to be your own.</p>
          <form onSubmit={submitWallet}>
            <label className="field">
              <span>Public wallet address</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} required />
            </label>
            <button className="primary-button" disabled={loading} type="submit">{loading ? "Reading wallet…" : "Calculate"}</button>
          </form>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {flow === "exchange" ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("choose")}>← Back</button>
          <span className="overline">Exchange</span>
          <h2>Choose your exchange</h2>
          <p className="step-copy">You’ll create a read-only API key in the next step.</p>
          <div className="choice-list compact">
            {(["bitvavo", "binance"] as Exchange[]).map((item) => (
              <button key={item} type="button" onClick={() => { setExchange(item); navigate("credentials"); }}>
                <span className={`exchange-icon ${item}`}>{item === "bitvavo" ? "B" : "◆"}</span>
                <span><strong>{exchangeNames[item]}</strong><small>Spot balances{item === "bitvavo" ? " and staking" : ""}</small></span>
                <i aria-hidden="true">→</i>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {flow === "credentials" && exchange ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("exchange")}>← Exchanges</button>
          <span className="overline">{exchangeNames[exchange]}</span>
          <h2>Connect read-only access</h2>
          <p className="step-copy">Create a key with read permissions only. Never enable trading or withdrawals.</p>
          <form onSubmit={submitExchange}>
            <label className="field">
              <span>API key</span>
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" spellCheck={false} required />
            </label>
            <label className="field">
              <span>API secret</span>
              <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="new-password" required />
            </label>
            <button className="primary-button" disabled={loading} type="submit">{loading ? "Reading balances…" : "Connect and calculate"}</button>
          </form>
          <div className="security-note">
            <span aria-hidden="true">✓</span>
            <p>Used once over HTTPS, then discarded. We do not store your credentials.</p>
          </div>
          <a className="help-link" href={exchange === "bitvavo" ? "https://docs.bitvavo.com/docs/get-started/" : "https://www.binance.com/en/my/settings/api-management"} target="_blank" rel="noreferrer">How to create a read-only key ↗</a>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
  }
}
