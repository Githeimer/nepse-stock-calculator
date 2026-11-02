export type BuyType = "BUY" | "IPO" | "RIGHT" | "BONUS";
export type TxType = BuyType | "SELL";

export interface TxRow {
  id: number;
  type: TxType;
  quantity: number;
  price_per_share: number;
  transaction_date: string;
  commission: number;
  sebon_fee: number;
  dp_charge: number;
  cgt: number;
  notes: string | null;
}

export interface StockRow {
  id: number;
  symbol: string;
  company_name: string | null;
  transactions: TxRow[];
}

export interface PriceRow {
  symbol: string;
  ltp: number;
  previous_close: number | null;
  price_time: string;
  source: "nepse" | "csv" | "manual";
}

export interface CommissionTier {
  up_to: number | null;
  rate: number;
}

export interface FeeSettings {
  commission_tiers: CommissionTier[];
  min_commission: number;
  sebon_rate: number;
  dp_charge: number;
  cgt_short_rate: number;
  cgt_long_rate: number;
  long_term_days: number;
}