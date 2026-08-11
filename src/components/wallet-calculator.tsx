"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Bitcoin, Check, ClipboardPaste, Euro, ExternalLink, Landmark, WalletCards } from "lucide-react";
import { PortfolioResults } from "@/components/portfolio-results";
import { connectBrowserWallet, discoverInjectedWallets, type BrowserWallet } from "@/lib/browser-wallets";
import type { PortfolioResponse } from "@/lib/types";

type Flow = "choose" | "wallets" | "paste" | "exchange" | "credentials";
type Exchange = "bitvavo" | "binance";

const exchangeNames: Record<Exchange, string> = { bitvavo: "Bitvavo", binance: "Binance" };

export function WalletCalculator() {
  const [flow, setFlow] = useState<Flow>("choose");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [address, setAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [browserWallets, setBrowserWallets] = useState<BrowserWallet[]>([]);

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
    setBrowserWallets([]);
    setError("");
  }

  async function requestPortfolio(endpoint: string, body: Record<string, string | undefined>) {
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

  async function findBrowserWallets() {
    setLoading(true);
    setError("");
    try {
      const discovered = await discoverInjectedWallets();
      if (!discovered.length) throw new Error("No compatible browser wallet was found. You can paste a public address instead.");
      setBrowserWallets(discovered);
      navigate("wallets");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t discover your browser wallets.");
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet(wallet: BrowserWallet) {
    setLoading(true);
    setError("");
    try {
      const addresses = await connectBrowserWallet(wallet);
      await requestPortfolio("/api/portfolio", { ethereumAddress: addresses.ethereum, solanaAddress: addresses.solana });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection was cancelled.");
      setLoading(false);
    }
  }

  if (result) {
    return <PortfolioResults result={result} onReset={reset} />;
  }

  return (
    <section className="flow-card" aria-live="polite" aria-busy={loading}>
      {flow === "choose" ? (
        <div className="flow-step">
          <h2>How do you want to check it?</h2>
          <div className="choice-list">
            <button type="button" onClick={() => navigate("paste")}>
              <span className="choice-icon paste" aria-hidden="true"><ClipboardPaste /></span>
              <span><strong>Paste a wallet address</strong><small>Instant. No connection needed.</small></span>
              <i aria-hidden="true"><ArrowRight /></i>
            </button>
            <button type="button" disabled={loading} onClick={findBrowserWallets}>
              <span className="choice-icon browser" aria-hidden="true"><WalletCards /></span>
              <span><strong>{loading ? "Finding wallets…" : "Connect a browser wallet"}</strong><small>Ethereum, Solana, and HyperEVM.</small></span>
              <i aria-hidden="true"><ArrowRight /></i>
            </button>
            <button type="button" onClick={() => navigate("exchange")}>
              <span className="choice-icon exchange" aria-hidden="true"><Landmark /></span>
              <span><strong>Connect an exchange</strong><small>Bitvavo or Binance.</small></span>
              <i aria-hidden="true"><ArrowRight /></i>
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {flow === "wallets" ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("choose")}><ArrowLeft /> Back</button>
          <h2>Choose your wallet</h2>
          <p className="step-copy">We’ll combine every supported account this wallet shares.</p>
          <div className="choice-list compact">
            {browserWallets.map((wallet) => (
              <button key={wallet.id} type="button" disabled={loading} onClick={() => connectWallet(wallet)}>
                <span className="wallet-letter" aria-hidden="true">{wallet.name.slice(0, 1)}</span>
                <span><strong>{wallet.name}</strong><small>{[wallet.evm ? "Ethereum + HyperEVM" : "", wallet.solana ? "Solana" : ""].filter(Boolean).join(" · ")}</small></span>
                <i aria-hidden="true"><ArrowRight /></i>
              </button>
            ))}
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {flow === "paste" ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("choose")}><ArrowLeft /> Back</button>
          <h2>Paste a wallet address</h2>
          <p className="step-copy">Enter any public Ethereum or Solana address. It doesn’t need to be your own.</p>
          <form onSubmit={submitWallet}>
            <label className="field">
              <span>Public wallet address</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x… or Solana address" autoComplete="off" spellCheck={false} required />
            </label>
            <button className="primary-button" disabled={loading} type="submit">{loading ? "Reading wallet…" : "Calculate"}</button>
          </form>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {flow === "exchange" ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("choose")}><ArrowLeft /> Back</button>
          <span className="overline">Exchange</span>
          <h2>Choose your exchange</h2>
          <p className="step-copy">You’ll create a read-only API key in the next step.</p>
          <div className="choice-list compact">
            {(["bitvavo", "binance"] as Exchange[]).map((item) => (
              <button key={item} type="button" onClick={() => { setExchange(item); navigate("credentials"); }}>
                <span className={`exchange-icon ${item}`} aria-hidden="true">{item === "bitvavo" ? <Euro /> : <Bitcoin />}</span>
                <span><strong>{exchangeNames[item]}</strong><small>Spot balances{item === "bitvavo" ? " and staking" : ""}</small></span>
                <i aria-hidden="true"><ArrowRight /></i>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {flow === "credentials" && exchange ? (
        <div className="flow-step">
          <button className="back-button" type="button" onClick={() => navigate("exchange")}><ArrowLeft /> Exchanges</button>
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
            <span aria-hidden="true"><Check /></span>
            <p>Used once over HTTPS, then discarded. We do not store your credentials.</p>
          </div>
          <a className="help-link" href={exchange === "bitvavo" ? "https://docs.bitvavo.com/docs/get-started/" : "https://www.binance.com/en/my/settings/api-management"} target="_blank" rel="noreferrer">How to create a read-only key <ExternalLink /></a>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
