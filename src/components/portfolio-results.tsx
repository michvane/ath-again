import type { PortfolioResponse } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

function formatPrice(value: number) {
  if (value >= 0.01) return price.format(value);
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 10 })}`;
}

type PortfolioResultsProps = {
  result: PortfolioResponse;
  onReset: () => void;
};

export function PortfolioResults({ result, onReset }: PortfolioResultsProps) {
  const walletResult = result.source.kind === "wallet";
  const overline = walletResult ? "Connected wallet · multichain" : result.source.label;

  return (
    <section className="results" id="results" aria-live="polite">
      <div className="results-heading">
        <div>
          <span className="overline">{overline}</span>
          <h2>Your portfolio at all-time highs</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>Check another portfolio</button>
      </div>

      <div className="summary-grid">
        <article>
          <span>Value today</span>
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
          <span role="columnheader">Asset</span><span role="columnheader">Holdings</span><span role="columnheader">Price now</span><span role="columnheader">ATH value</span>
        </div>
        {result.assets.map((asset) => (
          <div className="asset-row" role="row" key={`${asset.chain || result.source.provider}:${asset.id}`}>
            <div className="token" role="cell">
              <span className="token-icon">{asset.symbol.slice(0, 2)}</span>
              <span className="token-name">{asset.name}<small>{asset.symbol}{asset.chain ? ` · ${asset.chain}` : ""}</small></span>
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
