import { divRound, toPaisa, type Paisa } from "./money";
import type { TxRow, TxType } from "./types";

export interface Lot {
  txId: number;
  date: string;
  type: TxType;
  originalQty: number;
  remainingQty: number;
  price: Paisa;
  notes: string | null;
}

export interface Sale {
  txId: number;
  date: string;
  quantity: number;
  price: Paisa;
  cgt: Paisa;
  net: Paisa;
  allocatedCost: Paisa;
  realized: Paisa;
  notes: string | null;
}

export interface StockSummary {
  held: number;
  bought: number;
  sold: number;
  costBasis: Paisa;
  wacc: Paisa | null;
  lots: Lot[];
  sales: Sale[];
  realized: Paisa;
  proceeds: Paisa;
}

export class HoldingsError extends Error {}

export const EMPTY_SUMMARY: StockSummary = {
  held: 0,
  bought: 0,
  sold: 0,
  costBasis: 0n,
  wacc: null,
  lots: [],
  sales: [],
  realized: 0n,
  proceeds: 0n,
};

export function sortForReplay(txs: TxRow[]): TxRow[] {
  return [...txs].sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id - b.id
  );
}

export function replay(txs: TxRow[]): StockSummary {
  let held = 0;
  let bought = 0;
  let sold = 0;
  let cost: Paisa = 0n;
  let realized: Paisa = 0n;
  let proceeds: Paisa = 0n;
  const lots: Lot[] = [];
  const sales: Sale[] = [];

  for (const tx of sortForReplay(txs)) {
    const price = toPaisa(tx.price_per_share);
    const gross = price * BigInt(tx.quantity);
    const fees = toPaisa(tx.commission) + toPaisa(tx.sebon_fee) + toPaisa(tx.dp_charge);

    if (tx.type === "SELL") {
      if (tx.quantity > held) {
        throw new HoldingsError(
          `The sale of ${tx.quantity} kitta on ${tx.transaction_date} is more than the ${held} held on that date.`
        );
      }
      const allocated = divRound(cost * BigInt(tx.quantity), BigInt(held));
      const cgt = toPaisa(tx.cgt);
      const net = gross - fees - cgt;

      cost -= allocated;
      held -= tx.quantity;
      sold += tx.quantity;
      proceeds += net;
      realized += net - allocated;

      sales.push({
        txId: tx.id,
        date: tx.transaction_date,
        quantity: tx.quantity,
        price,
        cgt,
        net,
        allocatedCost: allocated,
        realized: net - allocated,
        notes: tx.notes,
      });

      let remaining = tx.quantity;
      for (const lot of lots) {
        if (remaining === 0) break;
        const take = Math.min(remaining, lot.remainingQty);
        lot.remainingQty -= take;
        remaining -= take;
      }
    } else {
      cost += gross + fees;
      held += tx.quantity;
      bought += tx.quantity;
      lots.push({
        txId: tx.id,
        date: tx.transaction_date,
        type: tx.type,
        originalQty: tx.quantity,
        remainingQty: tx.quantity,
        price,
        notes: tx.notes,
      });
    }
  }

  return {
    held,
    bought,
    sold,
    costBasis: cost,
    wacc: held > 0 ? divRound(cost, BigInt(held)) : null,
    lots: lots.filter((lot) => lot.remainingQty > 0),
    sales,
    realized,
    proceeds,
  };
}