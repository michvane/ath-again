import { NextRequest, NextResponse } from "next/server";
import { getPortfolio } from "@/lib/portfolio";

const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = typeof body.address === "string" ? body.address.trim() : "";

    if (!ETHEREUM_ADDRESS.test(address)) {
      return NextResponse.json({ error: "Enter a valid 42-character Ethereum address." }, { status: 400 });
    }

    const portfolio = await getPortfolio(address);
    return NextResponse.json(portfolio, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The alternate timeline is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
