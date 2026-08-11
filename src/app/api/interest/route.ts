import { NextRequest, NextResponse } from "next/server";

const CONNECTORS = new Set(["solana", "bitcoin", "kraken", "coinbase", "tron"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const connector = body && typeof body.connector === "string" ? body.connector.toLowerCase() : "";
  if (!CONNECTORS.has(connector)) return NextResponse.json({ ok: false }, { status: 400 });

  console.log(JSON.stringify({ level: "info", msg: "connector_interest", connector }));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
