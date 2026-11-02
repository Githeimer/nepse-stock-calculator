import { daysBetween } from "./date";
import { commissionFor, rateToMicros, sebonFeeFor } from "./fees";
import { divRound, toPaisa, type Paisa } from "./money";
import type { Lot } from "./portfolio";
import type { FeeSettings } from "./types";

export interface SaleFees {
  commission: Paisa;
  sebon: Paisa;
  dp: Paisa;
}

export interface SalePreview {
  gross: Paisa;
  fees: SaleFees;
  allocatedCost: Paisa;
  preTaxProfit: Paisa;
  longQty: number;
  shortQty: number;
  cgt: Paisa;
  net: Paisa;
  profit: Paisa;
}

export interface Position {
  held: number;
  costBasis: Paisa;
  lots: Lot[];
}

export function saleFees(gross: Paisa, settings: FeeSettings | null): SaleFees {
  if (!settings || gross === 0n) return { commission: 0n, sebon: 0n, dp: 0n };
  return {
    commission: commissionFor(gross, settings),
    sebon: sebonFeeFor(gross, settings),
    dp: toPaisa(settings.dp_charge),
  };
}

// Oldest lots are sold first when deciding which kitta count as long-term.
export function splitByHoldingPeriod(lots: Lot[], quantity: number, sellDate: string, longTermDays: number) {
  let remaining = quantity;
  let longQty = 0;
  let shortQty = 0;
  for (const lot of lots) {
    if (remaining === 0) break;
    const take = Math.min(remaining, lot.remainingQty);
    if (daysBetween(lot.date, sellDate) > longTermDays) longQty += take;
    else shortQty += take;
    remaining -= take;
  }
  return { longQty, shortQty };
}

export function cgtFor(
  preTaxProfit: Paisa,
  longQty: number,
  shortQty: number,
  settings: FeeSettings | null
): Paisa {
  const quantity = longQty + shortQty;
  if (!settings || preTaxProfit <= 0n || quantity === 0) return 0n;
  const weightedRate =
    BigInt(longQty) * rateToMicros(settings.cgt_long_rate) +
    BigInt(shortQty) * rateToMicros(settings.cgt_short_rate);
  return divRound(preTaxProfit * weightedRate, BigInt(quantity) * 1_000_000n);
}

export function previewSale(
  position: Position,
  quantity: number,
  price: Paisa,
  sellDate: string,
  settings: FeeSettings | null,
  override?: { fees: SaleFees; cgt: Paisa }
): SalePreview {
  const gross = price * BigInt(quantity);
  const fees = override?.fees ?? saleFees(gross, settings);
  const allocatedCost = divRound(position.costBasis * BigInt(quantity), BigInt(position.held));
  const preTaxProfit = gross - fees.commission - fees.sebon - fees.dp - allocatedCost;
  const { longQty, shortQty } = splitByHoldingPeriod(
    position.lots,
    quantity,
    sellDate,
    settings?.long_term_days ?? 365
  );
  const cgt = override?.cgt ?? cgtFor(preTaxProfit, longQty, shortQty, settings);
  const net = gross - fees.commission - fees.sebon - fees.dp - cgt;

  return { gross, fees, allocatedCost, preTaxProfit, longQty, shortQty, cgt, net, profit: net - allocatedCost };
}

export function formatRate(rate: number): string {
  return `${parseFloat((rate * 100).toFixed(3))}%`;
}