import { divRound, toPaisa, type Paisa } from "./money";
import type { BuyType, FeeSettings } from "./types";

const RATE_SCALE = 1_000_000n;

export function rateToMicros(rate: number): bigint {
  return BigInt(Math.round(rate * 1_000_000));
}

export function commissionFor(gross: Paisa, settings: FeeSettings): Paisa {
  const tiers = [...settings.commission_tiers].sort(
    (a, b) => (a.up_to ?? Number.POSITIVE_INFINITY) - (b.up_to ?? Number.POSITIVE_INFINITY)
  );
  const grossRs = Number(gross) / 100;
  const tier = tiers.find((t) => t.up_to === null || grossRs <= t.up_to) ?? tiers[tiers.length - 1];
  const fee = divRound(gross * rateToMicros(tier.rate), RATE_SCALE);
  const minimum = toPaisa(settings.min_commission);
  return fee > minimum ? fee : minimum;
}

export function sebonFeeFor(gross: Paisa, settings: FeeSettings): Paisa {
  return divRound(gross * rateToMicros(settings.sebon_rate), RATE_SCALE);
}

export interface Fees {
  commission: Paisa;
  sebon: Paisa;
  dp: Paisa;
}

export const NO_FEES: Fees = { commission: 0n, sebon: 0n, dp: 0n };

// IPO, right and bonus shares are allotted without broker fees.
// DP charge is levied when shares leave your account, so a buy starts at zero.
// Both can be overridden from your broker bill in the form.
export function buyFees(type: BuyType, gross: Paisa, settings: FeeSettings | null): Fees {
  if (!settings || type !== "BUY" || gross === 0n) return NO_FEES;
  return {
    commission: commissionFor(gross, settings),
    sebon: sebonFeeFor(gross, settings),
    dp: 0n,
  };
}