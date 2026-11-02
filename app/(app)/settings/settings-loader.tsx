import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FeeSettings } from "@/lib/types";
import { FeeSettingsForm } from "./fee-settings-form";

export async function SettingsLoader() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_settings")
    .select(
      "commission_tiers, min_commission, sebon_rate, dp_charge, cgt_short_rate, cgt_long_rate, long_term_days"
    )
    .maybeSingle();

  if (error) return <p className="error">Couldn't load settings: {error.message}</p>;
  return <FeeSettingsForm initial={(data ?? null) as FeeSettings | null} />;
}