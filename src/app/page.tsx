import Image from "next/image";
import { WalletCalculator } from "@/components/wallet-calculator";

const chartBars = [34, 48, 40, 62, 54, 78, 68, 92, 75, 100, 86, 112];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="app-frame">
        <nav className="nav" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="ATH, Again home">
            <span className="mark" aria-hidden="true">↗</span>
            ATH, AGAIN
          </a>
          <div className="nav-pills" aria-label="App information">
            <span className="nav-pill active">Calculator</span>
            <span className="nav-pill">Read-only</span>
            <span className="nav-lock" aria-hidden="true">⌁</span>
          </div>
        </nav>

        <div className="hero-stage" id="top">
          <div className="hero-visual" aria-hidden="true">
            <Image
              src="/hero-trader.png"
              alt=""
              fill
              priority
              sizes="(max-width: 760px) 100vw, 1100px"
            />
          </div>

          <div className="chart" aria-hidden="true">
            {chartBars.map((height, index) => (
              <span key={`${height}-${index}`} style={{ height }} />
            ))}
          </div>

          <div className="hero-copy">
            <span className="hero-badge">Portfolio therapy, free of charge</span>
            <h1>Your wallet<br />at its <em>absolute best.</em></h1>
            <p>
              One wallet in. One wildly optimistic number out. See what your
              holdings would be worth at every token’s all-time high.
            </p>
          </div>

          <WalletCalculator />
        </div>
      </section>

      <footer className="footer">
        <p>Prices are estimates, not promises. Sadly.</p>
        <p>Read-only · No transactions · Blockscout + CoinGecko</p>
      </footer>
    </main>
  );
}
