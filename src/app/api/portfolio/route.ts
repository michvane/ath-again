import { NextRequest, NextResponse } from "next/server";
import { detectAddress, ETHEREUM_ADDRESS, SOLANA_ADDRESS } from "@/lib/addresses";
import { getConnectedPortfolio } from "@/lib/portfolio";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const ethereumAddress = typeof body.ethereumAddress === "string" ? body.ethereumAddress.trim() : "";
    const solanaAddress = typeof body.solanaAddress === "string" ? body.solanaAddress.trim() : "";

    if (ethereumAddress || solanaAddress) {
      if (ethereumAddress && !ETHEREUM_ADDRESS.test(ethereumAddress)) {
        return NextResponse.json({ error: "The wallet returned an invalid Ethereum address." }, { status: 400 });
      }
      if (solanaAddress && !SOLANA_ADDRESS.test(solanaAddress)) {
        return NextResponse.json({ error: "The wallet returned an invalid Solana address." }, { status: 400 });
      }
      const portfolio = await getConnectedPortfolio({
        ethereum: ethereumAddress || undefined,
        solana: solanaAddress || undefined,
      });
      return NextResponse.json(portfolio, { headers: { "Cache-Control": "private, no-store" } });
    }

    const detectedAddress = detectAddress(address);
    if (detectedAddress) {
      const portfolio = await getConnectedPortfolio(detectedAddress);
      return NextResponse.json(portfolio, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Enter a valid Ethereum or Solana address." }, { status: 400 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The alternate timeline is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
