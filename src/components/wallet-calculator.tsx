"use client";

import { FormEvent, useState } from "react";
import type { PortfolioResponse } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

function formatPrice(value: number) {
  if (value >= 0.01) return price.format(value);
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 10 })}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCalculator() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function calculate(walletAddress: string) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "That wallet refused to reveal its alternate timeline.");
      setResult(body);
      requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await calculate(address);
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError("No browser wallet found. Paste a public Ethereum address instead.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const connected = accounts[0];
      if (!connected) throw new Error("No account was shared by the wallet.");
      setAddress(connected);
      await calculate(connected);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection was cancelled.");
    }
  }

  return (
    <div className="calculator">
      <form onSubmit={onSubmit} aria-label="Ethereum wallet calculator">
        <div className="entry-panel">
          <label htmlFor="wallet-address" className="sr-only">Ethereum wallet address</label>
          <input
            id="wallet-address"
            className="address-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Paste 0x wallet address"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button className="submit-button" disabled={loading} type="submit">
            {loading ? "Calculating…" : "Let me suffer →"}
          </button>
        </div>
        <div className="connect-row">
          <button className="wallet-button" disabled={loading} type="button" onClick={connectWallet}>Connect browser wallet</button>
          <span className="privacy-note">Read-only. We never ask you to sign anything.</span>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>

      {loading && (
        <div className="loading" aria-live="polite">
          <div className="loading-line" />
          <p>Finding the version of you who sold the top…</p>
        </div>
      )}

      {result && (
        <section className="results" id="results" aria-live="polite">
          <div className="results-header">
            <div>
              <p className="kicker">THE PAINFUL TRUTH FOR {shortAddress(result.address)}</p>
              <h2>Your alternate timeline.</h2>
            </div>
            <button className="try-again" onClick={() => { setResult(null); setAddress(""); }}>Try another wallet</button>
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
                  <span className="token-icon">
                    {asset.symbol.slice(0, 2)}
                  </span>
                  <span className="token-name">{asset.name}<small className="token-symbol">{asset.symbol}</small></span>
                </div>
                <span className="number" role="cell"><i className="mobile-label">Holdings</i>{quantity.format(asset.amount)}</span>
                <span className="number" role="cell"><i className="mobile-label">Price now</i>{formatPrice(asset.currentPrice)}</span>
                <strong className="number" role="cell"><i className="mobile-label">ATH value</i>{money.format(asset.athValue)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
  }
}
