import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATH, Again — Your portfolio at all-time highs",
  description: "See what your crypto portfolio would be worth if every held asset revisited its all-time high.",
  openGraph: {
    title: "ATH, Again",
    description: "A tiny calculator for enormous crypto regrets.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "ATH, Again", description: "A tiny calculator for enormous crypto regrets." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
