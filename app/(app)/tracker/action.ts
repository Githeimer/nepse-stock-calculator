"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInNepal } from "@/lib/data";
import type { BuyType } from "@/lib/types";

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