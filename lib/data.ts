import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { toPaisa, type Paisa } from "./money";
import { EMPTY_SUMMARY, HoldingsError, replay, type StockSummary } from "./portfolio";
import type { FeeSettings, PriceRow, StockRow } from "./types";
export { daysBetween, todayInNepal } from "./date";

export interface Holding {
  id: number;
  symbol: string;
  companyName: string | null;
  summary: StockSummary;
  price: PriceRow | null;
  ltp: Paisa | null;
  marketValue: Paisa | null;
  unrealized: Paisa | null;
  unrealizedPct: number | null;
  problem: string | null;
}

export const getTrackerData = cache(async () => {
  const supabase = await createClient();

  const [stocksResult, feesResult] = await Promise.all([
    supabase
      .from("stocks")
      .select(
        "id, symbol, company_name, transactions(id, type, quantity, price_per_share, transaction_date, commission, sebon_fee, dp_charge, cgt, notes)"
      )
      .order("symbol"),
    supabase
      .from("fee_settings")
      .select(
        "commission_tiers, min_commission, sebon_rate, dp_charge, cgt_short_rate, cgt_long_rate, long_term_days"
      )
      .maybeSingle(),
  ]);

  if (stocksResult.error) throw new Error(stocksResult.error.message);
  if (feesResult.error) throw new Error(feesResult.error.message);

  const stocks = (stocksResult.data ?? []) as StockRow[];
  const symbols = stocks.map((s) => s.symbol);

  let prices: PriceRow[] = [];
  if (symbols.length > 0) {
    const pricesResult = await supabase
      .from("market_prices")
      .select("symbol, ltp, previous_close, price_time, source")
      .in("symbol", symbols);
    if (pricesResult.error) throw new Error(pricesResult.error.message);
    prices = (pricesResult.data ?? []) as PriceRow[];
  }

  const priceBySymbol = new Map(prices.map((p) => [p.symbol, p]));

  const holdings: Holding[] = stocks.map((stock) => {
    let summary = EMPTY_SUMMARY;
    let problem: string | null = null;
    try {
      summary = replay(stock.transactions ?? []);
    } catch (error) {
      if (!(error instanceof HoldingsError)) throw error;
      problem = error.message;
    }

    const price = priceBySymbol.get(stock.symbol) ?? null;
    const ltp = price ? toPaisa(price.ltp) : null;
    const marketValue = ltp !== null ? ltp * BigInt(summary.held) : null;
    const unrealized = marketValue !== null ? marketValue - summary.costBasis : null;
    const unrealizedPct =
      unrealized !== null && summary.costBasis > 0n
        ? (Number(unrealized) / Number(summary.costBasis)) * 100
        : null;

    return {
      id: stock.id,
      symbol: stock.symbol,
      companyName: stock.company_name,
      summary,
      price,
      ltp,
      marketValue,
      unrealized,
      unrealizedPct,
      problem,
    };
  });

  return { holdings, fees: (feesResult.data ?? null) as FeeSettings | null };
});

export function portfolioTotals(holdings: Holding[]) {
  let cost: Paisa = 0n;
  let pricedCost: Paisa = 0n;
  let value: Paisa = 0n;
  let realized: Paisa = 0n;
  let kitta = 0;
  let stocksHeld = 0;
  let unpriced = 0;

  for (const h of holdings) {
    realized += h.summary.realized;
    if (h.summary.held === 0) continue;
    stocksHeld += 1;
    kitta += h.summary.held;
    cost += h.summary.costBasis;
    if (h.marketValue === null) {
      unpriced += 1;
      continue;
    }
    pricedCost += h.summary.costBasis;
    value += h.marketValue;
  }

  return { cost, pricedCost, value, unrealized: value - pricedCost, realized, kitta, stocksHeld, unpriced };
}
