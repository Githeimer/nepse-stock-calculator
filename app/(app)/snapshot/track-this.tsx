"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addBuy, type BuyState } from "../tracker/action";

const initialState: BuyState = { error: null, savedSymbol: null, savedAt: 0 };

interface Props {
  symbol: string;
  quantity: number;
  wacc: number;
  today: string;
  defaultDate: string;
}

export function TrackThis({ symbol, quantity, wacc, today, defaultDate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addBuy, initialState);
  const handled = useRef(0);
  const price = wacc.toFixed(2);

  useEffect(() => {
    if (state.savedSymbol && state.savedAt !== handled.current) {
      handled.current = state.savedAt;
      dialogRef.current?.close();
      router.push(`/tracker/${state.savedSymbol}`);
    }
  }, [state, router]);

  return (
    <>
      <button className="btn small" type="button" onClick={() => dialogRef.current?.showModal()}>
        Track this
      </button>
      <dialog ref={dialogRef} className="dialog" aria-label={`Track ${symbol}`}>
        <form action={formAction} className="form">
          <h2>Track {symbol}</h2>
          <p className="muted small">
            Adds {quantity} kitta at your Meroshare WACC of Rs {price} as one lot. Fees are already part
            of the WACC, so they're set to zero.
          </p>

          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="price" value={price} />
          <input type="hidden" name="commission" value="0" />
          <input type="hidden" name="sebon_fee" value="0" />
          <input type="hidden" name="dp_charge" value="0" />
          <input type="hidden" name="notes" value="Added from Meroshare WACC" />

          <div className="form-row">
            <label className="field">
              Type
              <select name="type" defaultValue={wacc === 100 ? "IPO" : "BUY"}>
                <option value="BUY">Market buy</option>
                <option value="IPO">IPO</option>
                <option value="RIGHT">Right shares</option>
                <option value="BONUS">Bonus shares</option>
              </select>
            </label>
            <label className="field">
              Date
              <input name="date" type="date" defaultValue={defaultDate} max={today} required />
            </label>
          </div>
          <p className="muted small">
            The date defaults to when Meroshare last updated this WACC, which is usually your latest
            purchase. Change it if yours is different.
          </p>

          {state.error && (
            <p className="error" role="alert">
              {state.error}
            </p>
          )}

          <div className="form-actions">
            <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add to tracker"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}