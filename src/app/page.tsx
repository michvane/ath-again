import { WalletCalculator } from "@/components/wallet-calculator";

export default function Home() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="ATH, Again home">
          <span className="mark" aria-hidden="true">↗</span>
          ATH, AGAIN
        </a>
      </header>

      <section className="intro" id="top">
        <h1>Everything you hold, back at ATH.</h1>
        <p>See what your portfolio would be worth if every asset climbed back to its all-time high.</p>
      </section>

      <WalletCalculator />

      <footer className="footer">
        <span>Highs are historical. Hope is free.</span>
      </footer>
    </main>
  );
}
