import { NextRequest, NextResponse } from "next/server";
import { getExchangePortfolio, type ExchangeName } from "@/lib/exchange";

const EXCHANGES = new Set<ExchangeName>(["bitvavo", "binance"]);

function isExchange(value: string): value is ExchangeName {
  return EXCHANGES.has(value as ExchangeName);
}

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");

  try {
    const body = await request.json();
    const exchange = typeof body.exchange === "string" ? body.exchange.toLowerCase() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const secret = typeof body.secret === "string" ? body.secret.trim() : "";

    if (!isExchange(exchange) || !apiKey || !secret || apiKey.length > 256 || secret.length > 256) {
      return NextResponse.json({ error: "Choose an exchange and enter both read-only API credentials." }, { status: 400 });
    }

    console.log(JSON.stringify({ level: "info", msg: "exchange_portfolio_start", exchange, requestId }));
    const portfolio = await getExchangePortfolio(exchange, apiKey, secret);
    console.log(JSON.stringify({ level: "info", msg: "exchange_portfolio_done", exchange, requestId, ms: Date.now() - startedAt, assets: portfolio.assets.length }));
    return NextResponse.json(portfolio, { headers: { "Cache-Control": "private, no-store" } });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The exchange connection failed.";
    console.error(JSON.stringify({ level: "error", msg: "exchange_portfolio_failed", requestId, ms: Date.now() - startedAt, error: message }));
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
