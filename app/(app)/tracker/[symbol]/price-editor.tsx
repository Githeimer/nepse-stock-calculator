"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updatePrice, type PriceState } from "../action";
import { toAmountString } from "@/lib/money";

const initialState: PriceState = { error: null, savedAt: 0 };

export function PriceEditor({ symbol, ltp }: { symbol: string; ltp: bigint | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updatePrice, initialState);
  const handled = useRef(0);

  useEffect(() => {
    if (state.savedAt && state.savedAt !== handled.current) {
      handled.current = state.savedAt;
      setEditing(false);
    }
  }, [state]);

  if (!editing) {
    return (
      <button className="link small" type="button" onClick={() => setEditing(true)}>
        {ltp === null ? "Add price" : "Edit price"}
      </button>
    );
  }

  return (
    <form action={formAction} className="price-form">
      <input type="hidden" name="symbol" value={symbol} />
      <input
        name="ltp"
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        defaultValue={ltp !== null ? toAmountString(ltp) : ""}
        aria-label={`Price of ${symbol}`}
        autoFocus
        required
      />
      <button className="btn primary small" type="submit" disabled={pending}>
        Save
      </button>
      <button className="btn small" type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {state.error && <p className="error small">{state.error}</p>}
    </form>
  );
}