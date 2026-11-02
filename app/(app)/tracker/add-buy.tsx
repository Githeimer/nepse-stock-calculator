"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { addBuy, type BuyState } from "./action";
import { buyFees, type Fees } from "@/lib/fees";
import { divRound, formatRs, toAmountString, toPaisa } from "@/lib/money";
import type { BuyType, FeeSettings } from "@/lib/types";

const TYPE_LABELS: Record<BuyType, string> = {
  BUY: "Market buy",
  IPO: "IPO",
  RIGHT: "Right shares",
  BONUS: "Bonus shares",
};

const initialState: BuyState = { error: null, savedSymbol: null, savedAt: 0 };

interface Props {
  fees: FeeSettings | null;
  symbols: string[];
  today: string;
}

export function AddBuy({ fees, symbols, today }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const [formKey, setFormKey] = useState(0);

  function open() {
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function saved(symbol: string) {
    close();
    router.push(`/tracker/${symbol}`);
  }

  return (
    <>
      <button className="btn primary" type="button" onClick={open}>
        Add buy
      </button>
      <dialog ref={dialogRef} className="dialog" aria-labelledby="add-buy-title">
        {formKey > 0 && (
          <BuyForm
            key={formKey}
            fees={fees}
            symbols={symbols}
            today={today}
            defaultSymbol={segment ? decodeURIComponent(segment) : ""}
            onCancel={close}
            onSaved={saved}
          />
        )}
      </dialog>
    </>
  );
}

interface FormProps extends Props {
  defaultSymbol: string;
  onCancel: () => void;
  onSaved: (symbol: string) => void;
}

function parseAmount(value: string): bigint {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? toPaisa(n) : 0n;
}

function BuyForm({ fees, symbols, today, defaultSymbol, onCancel, onSaved }: FormProps) {
  const [state, formAction, pending] = useActionState(addBuy, initialState);
  const [type, setType] = useState<BuyType>("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [manualFees, setManualFees] = useState(false);
  const [feeInputs, setFeeInputs] = useState({ commission: "", sebon: "", dp: "" });
  const handled = useRef(0);

  useEffect(() => {
    if (state.savedSymbol && state.savedAt !== handled.current) {
      handled.current = state.savedAt;
      onSaved(state.savedSymbol);
    }
  }, [state, onSaved]);

  const qty = Number(quantity);
  const priceNum = Number(price);
  const valid =
    Number.isInteger(qty) && qty > 0 && price.trim() !== "" && Number.isFinite(priceNum) && priceNum >= 0;
  const gross = valid ? toPaisa(priceNum) * BigInt(qty) : 0n;
  const autoFees = buyFees(type, gross, fees);
  const effective: Fees = manualFees
    ? {
        commission: parseAmount(feeInputs.commission),
        sebon: parseAmount(feeInputs.sebon),
        dp: parseAmount(feeInputs.dp),
      }
    : autoFees;
  const totalFees = effective.commission + effective.sebon + effective.dp;
  const total = gross + totalFees;

  function changeType(next: BuyType) {
    setType(next);
    if (next !== "BUY" && price === "") setPrice("100");
  }

  function toggleManual(on: boolean) {
    setManualFees(on);
    if (on) {
      setFeeInputs({
        commission: toAmountString(autoFees.commission),
        sebon: toAmountString(autoFees.sebon),
        dp: toAmountString(autoFees.dp),
      });
    }
  }

  return (
    <form action={formAction} className="form">
      <h2 id="add-buy-title">Add buy</h2>

      <div className="form-row">
        <label className="field">
          Symbol
          <input
            name="symbol"
            className="uppercase"
            defaultValue={defaultSymbol}
            list="tracked-symbols"
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
          <datalist id="tracked-symbols">
            {symbols.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          Type
          <select name="type" value={type} onChange={(e) => changeType(e.target.value as BuyType)}>
            {(Object.keys(TYPE_LABELS) as BuyType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          Date
          <input name="date" type="date" defaultValue={today} max={today} required />
        </label>
        <label className="field">
          Kitta
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="field">
        Price per share (Rs)
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </label>

      <label className="check">
        <input type="checkbox" checked={manualFees} onChange={(e) => toggleManual(e.target.checked)} />
        Enter fees from my broker bill
      </label>

      {manualFees ? (
        <div className="form-row three">
          <label className="field">
            Commission
            <input
              name="commission"
              type="number"
              min="0"
              step="0.01"
              value={feeInputs.commission}
              onChange={(e) => setFeeInputs({ ...feeInputs, commission: e.target.value })}
            />
          </label>
          <label className="field">
            SEBON fee
            <input
              name="sebon_fee"
              type="number"
              min="0"
              step="0.01"
              value={feeInputs.sebon}
              onChange={(e) => setFeeInputs({ ...feeInputs, sebon: e.target.value })}
            />
          </label>
          <label className="field">
            DP charge
            <input
              name="dp_charge"
              type="number"
              min="0"
              step="0.01"
              value={feeInputs.dp}
              onChange={(e) => setFeeInputs({ ...feeInputs, dp: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="commission" value={toAmountString(autoFees.commission)} />
          <input type="hidden" name="sebon_fee" value={toAmountString(autoFees.sebon)} />
          <input type="hidden" name="dp_charge" value={toAmountString(autoFees.dp)} />
        </>
      )}

      <table className="summary">
        <tbody>
          <tr>
            <td>Gross amount</td>
            <td className="num">{formatRs(gross)}</td>
          </tr>
          <tr>
            <td>
              Fees
              {!fees && !manualFees && <span className="muted small"> (no fee settings found)</span>}
            </td>
            <td className="num">{formatRs(totalFees)}</td>
          </tr>
          <tr className="total">
            <td>Total cost</td>
            <td className="num">{formatRs(total)}</td>
          </tr>
          <tr>
            <td className="muted">Cost per kitta</td>
            <td className="num muted">{valid ? formatRs(divRound(total, BigInt(qty))) : "—"}</td>
          </tr>
        </tbody>
      </table>

      <label className="field">
        Notes (optional)
        <input name="notes" maxLength={200} />
      </label>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-actions">
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save buy"}
        </button>
      </div>
    </form>
  );
}