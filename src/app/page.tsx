import { WalletCalculator } from "@/components/wallet-calculator";

export default function Home() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="ATH, Again home">
          <span className="mark" aria-hidden="true">↗</span>
          ATH, AGAIN
        </a>
        <span className="read-only">Read-only</span>
      </header>

      <section className="intro" id="top">
        <h1>What if you sold at the top?</h1>
        <p>Connect where your crypto lives. We’ll show what it could be worth if every asset returned to its all-time high.</p>
      </section>

      <WalletCalculator />

      <footer className="footer">
        <span>For entertainment, not financial advice.</span>
        <span>No transactions. No stored credentials.</span>
      </footer>
    </main>
  );
}
