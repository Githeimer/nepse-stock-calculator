"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CommissionTier } from "@/lib/types";

export type SettingsState = { error: string | null; savedAt: number };

function toRate(percent: number): number {
  return Number((percent / 100).toFixed(6));
}

function isPercent(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function isAmount(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export async function saveFeeSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const fail = (error: string): SettingsState => ({ error, savedAt: 0 });

  const upTos = formData.getAll("tier_up_to").map((v) => String(v).trim());
  const rates = formData.getAll("tier_rate").map((v) => Number(v));
  if (upTos.length === 0 || upTos.length !== rates.length) return fail("Add at least one commission tier.");

  const tiers: CommissionTier[] = [];
  let previous = 0;
  for (let i = 0; i < upTos.length; i++) {
    const isLast = i === upTos.length - 1;
    if (!isPercent(rates[i])) return fail(`Tier ${i + 1}: enter a rate between 0 and 100%.`);

    if (upTos[i] === "") {
      if (!isLast) return fail(`Only the last tier can be left without an "Up to" amount.`);
      tiers.push({ up_to: null, rate: toRate(rates[i]) });
      continue;
    }

    const upTo = Number(upTos[i]);
    if (!Number.isInteger(upTo) || upTo <= previous) {
      return fail(`Tier ${i + 1}: "Up to" must be a whole number above the previous tier.`);
    }
    previous = upTo;
    tiers.push({ up_to: upTo, rate: toRate(rates[i]) });
  }
  if (tiers[tiers.length - 1].up_to !== null) {
    return fail(`Leave "Up to" empty on the last tier so that large trades are covered.`);
  }

  const minCommission = Number(formData.get("min_commission"));
  const sebonPercent = Number(formData.get("sebon_rate"));
  const dpCharge = Number(formData.get("dp_charge"));
  const cgtShortPercent = Number(formData.get("cgt_short_rate"));
  const cgtLongPercent = Number(formData.get("cgt_long_rate"));
  const longTermDays = Number(formData.get("long_term_days"));

  if (!isAmount(minCommission)) return fail("Enter a valid minimum commission.");
  if (!isPercent(sebonPercent)) return fail("Enter a SEBON fee between 0 and 100%.");
  if (!isAmount(dpCharge)) return fail("Enter a valid DP charge.");
  if (!isPercent(cgtShortPercent) || !isPercent(cgtLongPercent)) return fail("Enter tax rates between 0 and 100%.");
  if (!Number.isInteger(longTermDays) || longTermDays < 0 || longTermDays > 3650) {
    return fail("Enter the long-term holding period in whole days.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired. Sign in again.");

  const { error } = await supabase.from("fee_settings").upsert(
    {
      user_id: user.id,
      commission_tiers: tiers,
      min_commission: minCommission,
      sebon_rate: toRate(sebonPercent),
      dp_charge: dpCharge,
      cgt_short_rate: toRate(cgtShortPercent),
      cgt_long_rate: toRate(cgtLongPercent),
      long_term_days: longTermDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return fail(`Couldn't save settings: ${error.message}`);

  revalidatePath("/", "layout");
  return { error: null, savedAt: Date.now() };
}