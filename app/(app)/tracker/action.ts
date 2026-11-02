"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInNepal } from "@/lib/data";
import type { BuyType } from "@/lib/types";
import { HoldingsError, replay } from "@/lib/portfolio";
import type { TxRow } from "@/lib/types";

export type BuyState = {
  error: string | null;
  savedSymbol: string | null;
  savedAt: number;
};

const BUY_TYPES: BuyType[] = ["BUY", "IPO", "RIGHT", "BONUS"];

function isAmount(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

function fail(error: string): BuyState {
  return { error, savedSymbol: null, savedAt: 0 };
}

export async function addBuy(_prev: BuyState, formData: FormData): Promise<BuyState> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "") as BuyType;
  const date = String(formData.get("date") ?? "");
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const commission = Number(formData.get("commission") || 0);
  const sebonFee = Number(formData.get("sebon_fee") || 0);
  const dpCharge = Number(formData.get("dp_charge") || 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!/^[A-Z0-9]{1,20}$/.test(symbol)) return fail("Enter a valid stock symbol, like SHIVM.");
  if (!BUY_TYPES.includes(type)) return fail("Choose how you got these shares.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Enter the purchase date.");
  if (date > todayInNepal()) return fail("The purchase date can't be in the future.");
  if (!Number.isInteger(quantity) || quantity <= 0) return fail("Kitta must be a whole number above zero.");
  if (!isAmount(price)) return fail("Enter a valid price per share.");
  if (type === "BUY" && price === 0) return fail("A market buy needs a price above zero.");
  if (![commission, sebonFee, dpCharge].every(isAmount)) return fail("Fees must be zero or positive amounts.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired. Sign in again.");

  const { data: stock, error: stockError } = await supabase
    .from("stocks")
    .upsert({ user_id: user.id, symbol }, { onConflict: "user_id,symbol" })
    .select("id")
    .single();
  if (stockError || !stock) return fail(`Couldn't save the stock: ${stockError?.message}`);

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: user.id,
    stock_id: stock.id,
    type,
    quantity,
    price_per_share: price,
    transaction_date: date,
    commission,
    sebon_fee: sebonFee,
    dp_charge: dpCharge,
    notes,
  });
  if (txError) return fail(`Couldn't save the buy: ${txError.message}`);

  revalidatePath("/tracker", "layout");
  return { error: null, savedSymbol: symbol, savedAt: Date.now() };
}

export type SaleState = { error: string | null; savedAt: number };

export async function recordSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const fail = (error: string): SaleState => ({ error, savedAt: 0 });

  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const date = String(formData.get("date") ?? "");
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const commission = Number(formData.get("commission") || 0);
  const sebonFee = Number(formData.get("sebon_fee") || 0);
  const dpCharge = Number(formData.get("dp_charge") || 0);
  const cgt = Number(formData.get("cgt") || 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!/^[A-Z0-9]{1,20}$/.test(symbol)) return fail("Unknown stock.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Enter the sale date.");
  if (date > todayInNepal()) return fail("The sale date can't be in the future.");
  if (!Number.isInteger(quantity) || quantity <= 0) return fail("Kitta must be a whole number above zero.");
  if (!isAmount(price) || price === 0) return fail("Enter a sell price above zero.");
  if (![commission, sebonFee, dpCharge, cgt].every(isAmount)) return fail("Fees and tax must be zero or positive amounts.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired. Sign in again.");

  const { data: stock, error: stockError } = await supabase
    .from("stocks")
    .select(
      "id, transactions(id, type, quantity, price_per_share, transaction_date, commission, sebon_fee, dp_charge, cgt, notes)"
    )
    .eq("symbol", symbol)
    .maybeSingle();
  if (stockError) return fail(`Couldn't load ${symbol}: ${stockError.message}`);
  if (!stock) return fail(`You don't track ${symbol}.`);

  const candidate: TxRow = {
    id: Number.MAX_SAFE_INTEGER,
    type: "SELL",
    quantity,
    price_per_share: price,
    transaction_date: date,
    commission,
    sebon_fee: sebonFee,
    dp_charge: dpCharge,
    cgt,
    notes,
  };

  try {
    replay([...((stock.transactions ?? []) as TxRow[]), candidate]);
  } catch (error) {
    if (error instanceof HoldingsError) return fail(error.message);
    throw error;
  }

  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: user.id,
    stock_id: stock.id,
    type: "SELL",
    quantity,
    price_per_share: price,
    transaction_date: date,
    commission,
    sebon_fee: sebonFee,
    dp_charge: dpCharge,
    cgt,
    notes,
  });
  if (insertError) return fail(`Couldn't save the sale: ${insertError.message}`);

  revalidatePath("/tracker", "layout");
  return { error: null, savedAt: Date.now() };
}

export type PriceState = { error: string | null; savedAt: number };

export async function updatePrice(_prev: PriceState, formData: FormData): Promise<PriceState> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const ltp = Number(formData.get("ltp"));

  if (!/^[A-Z0-9]{1,20}$/.test(symbol)) return { error: "Unknown stock.", savedAt: 0 };
  if (!isAmount(ltp) || ltp === 0) return { error: "Enter a price above zero.", savedAt: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again.", savedAt: 0 };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("market_prices")
    .upsert(
      { symbol, ltp, price_time: now, source: "manual", updated_at: now },
      { onConflict: "symbol" }
    );
  if (error) return { error: `Couldn't save the price: ${error.message}`, savedAt: 0 };

  revalidatePath("/tracker", "layout");
  return { error: null, savedAt: Date.now() };
}