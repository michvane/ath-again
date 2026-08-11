export type PortfolioAsset = {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  image: string | null;
  currentPrice: number;
  athPrice: number;
  athDate: string | null;
  currentValue: number;
  athValue: number;
};

export type PortfolioResponse = {
  address: string;
  source: {
    kind: "wallet" | "exchange";
    provider: string;
    label: string;
  };
  fetchedAt: string;
  totals: {
    current: number;
    ath: number;
    upside: number;
    multiplier: number;
    matchedAssets: number;
    eligibleAssets: number;
  };
  assets: PortfolioAsset[];
  note: string;
};
