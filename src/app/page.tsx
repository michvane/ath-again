import { WalletCalculator } from "@/components/wallet-calculator";

export default function Home() {
  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="ATH, Again home">
          <span className="mark" aria-hidden="true">↗</span>
          ATH, AGAIN
        </a>
        <span className="nav-note">NO SIGNATURES. NO SHAME.</span>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span /> A tiny calculator for enormous regrets</div>
        <h1>
          See the portfolio<br />you <em>could’ve</em> had.
        </h1>
        <p className="lede">
          Paste an Ethereum wallet—or connect yours—and we’ll calculate what
          its tokens would be worth if they revisited their all-time highs.
        </p>
        <WalletCalculator />
      </section>

      <footer className="footer shell">
        <p>Prices are estimates, not promises. Sadly.</p>
        <p>Read-only · No transactions · Data by Blockscout + CoinGecko</p>
      </footer>
    </main>
  );
}
