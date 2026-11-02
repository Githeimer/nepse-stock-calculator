"use client";

import { useActionState, useState } from "react";
import { saveFeeSettings, type SettingsState } from "./actions";
import type { FeeSettings } from "@/lib/types";

const DEFAULTS: FeeSettings = {
  commission_tiers: [
    { up_to: 50000, rate: 0.0036 },
    { up_to: 500000, rate: 0.0033 },
    { up_to: 2000000, rate: 0.0031 },
    { up_to: 10000000, rate: 0.0027 },
    { up_to: null, rate: 0.0024 },
  ],
  min_commission: 10,
  sebon_rate: 0.00015,
  dp_charge: 25,
  cgt_short_rate: 0.075,
  cgt_long_rate: 0.05,
  long_term_days: 365,
};

function percent(rate: number): string {
  return String(parseFloat((rate * 100).toFixed(4)));
}

const initialState: SettingsState = { error: null, savedAt: 0 };

export function FeeSettingsForm({ initial }: { initial: FeeSettings | null }) {
  const start = initial ?? DEFAULTS;
  const [state, formAction, pending] = useActionState(saveFeeSettings, initialState);
  const [tiers, setTiers] = useState(
    start.commission_tiers.map((t) => ({
      upTo: t.up_to === null ? "" : String(t.up_to),
      rate: percent(t.rate),
    }))
  );

  function updateTier(index: number, field: "upTo" | "rate", value: string) {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addTier() {
    setTiers([...tiers.slice(0, -1), { upTo: "", rate: "" }, tiers[tiers.length - 1]]);
  }

  function removeTier(index: number) {
    setTiers(tiers.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="settings-form">
      <section>
        <h2>Broker commission</h2>
        <p className="muted small">
          The rate for the tier a trade's total amount falls into applies to the whole amount. Leave
          "Up to" empty on the last row for "and above".
        </p>
        <div className="table-wrap">
          <table className="data tiers">
            <thead>
              <tr>
                <th>Up to (Rs)</th>
                <th>Rate (%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, i) => (
                <tr key={i}>
                  <td>
                    <input
                      name="tier_up_to"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="and above"
                      value={tier.upTo}
                      onChange={(e) => updateTier(i, "upTo", e.target.value)}
                      aria-label={`Tier ${i + 1} up to`}
                    />
                  </td>
                  <td>
                    <input
                      name="tier_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.0001"
                      value={tier.rate}
                      onChange={(e) => updateTier(i, "rate", e.target.value)}
                      aria-label={`Tier ${i + 1} rate`}
                      required
                    />
                  </td>
                  <td>
                    {tiers.length > 1 && (
                      <button className="link small danger" type="button" onClick={() => removeTier(i)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="link small" type="button" onClick={addTier}>
          Add tier
        </button>
        <label className="field narrow">
          Minimum commission (Rs)
          <input name="min_commission" type="number" min="0" step="0.01" defaultValue={start.min_commission} required />
        </label>
      </section>

      <section>
        <h2>Other fees</h2>
        <div className="form-row">
          <label className="field">
            SEBON fee (%)
            <input name="sebon_rate" type="number" min="0" max="100" step="0.0001" defaultValue={percent(start.sebon_rate)} required />
          </label>
          <label className="field">
            DP charge per sale (Rs)
            <input name="dp_charge" type="number" min="0" step="0.01" defaultValue={start.dp_charge} required />
          </label>
        </div>
      </section>

      <section>
        <h2>Capital gains tax</h2>
        <div className="form-row three">
          <label className="field">
            Short-term (%)
            <input name="cgt_short_rate" type="number" min="0" max="100" step="0.01" defaultValue={percent(start.cgt_short_rate)} required />
          </label>
          <label className="field">
            Long-term (%)
            <input name="cgt_long_rate" type="number" min="0" max="100" step="0.01" defaultValue={percent(start.cgt_long_rate)} required />
          </label>
          <label className="field">
            Long-term after (days)
            <input name="long_term_days" type="number" min="0" step="1" defaultValue={start.long_term_days} required />
          </label>
        </div>
      </section>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt > 0 && <p className="gain">Settings saved.</p>}

      <div>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}