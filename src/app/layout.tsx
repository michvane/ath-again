import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ath-again.vercel.app"),
  title: "ATH, Again — Your portfolio at all-time highs",
  description: "See what your crypto portfolio would be worth if every held asset revisited its all-time high.",
  openGraph: {
    title: "ATH, Again",
    description: "See what your crypto portfolio could be worth if every held asset revisited its all-time high.",
    url: "/",
    siteName: "ATH, Again",
    type: "website",
  },
  twitter: { card: "summary", title: "ATH, Again", description: "Your current crypto portfolio, valued at every asset's all-time high." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
