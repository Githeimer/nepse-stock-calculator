"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteTransaction,
  updateTransaction,
  type DeleteState,
  type EditState,
} from "../action";
import { buyFees } from "@/lib/fees";
import { toAmountString, toPaisa } from "@/lib/money";
import { replay, sortForReplay } from "@/lib/portfolio";
import { previewSale } from "@/lib/sell";
import type { BuyType, FeeSettings, TxRow } from "@/lib/types";

const BUY_LABELS: Record<BuyType, string> = {
  BUY: "Market buy",
  IPO: "IPO",
  RIGHT: "Right shares",
  BONUS: "Bonus shares",
};

interface EditProps {
  tx: TxRow;
  transactions: TxRow[];
  fees: FeeSettings | null;
  today: string;
}

export function EditTransaction(props: EditProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  function open() {
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button className="link small" type="button" onClick={open}>
        Edit
      </button>
      <dialog ref={dialogRef} className="dialog" aria-label="Edit transaction">
        {formKey > 0 && <EditForm key={formKey} {...props} onDone={close} />}
      </dialog>
    </>
  );
}

const initialEdit: EditState = { error: null, savedAt: 0 };

function EditForm({ tx, transactions, fees, today, onDone }: EditProps & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateTransaction, initialEdit);
  const isSell = tx.type === "SELL";
  const [type, setType] = useState(tx.type);
  const [date, setDate] = useState(tx.transaction_date);
  const [quantity, setQuantity] = useState(String(tx.quantity));
  const [price, setPrice] = useState(tx.price_per_share.toFixed(2));
  const [amounts, setAmounts] = useState({
    commission: tx.commission.toFixed(2),
    sebon: tx.sebon_fee.toFixed(2),
    dp: tx.dp_charge.toFixed(2),
    cgt: tx.cgt.toFixed(2),
  });
  const [note, setNote] = useState<string | null>(null);
  const handled = useRef(0);

  useEffect(() => {
    if (state.savedAt && state.savedAt !== handled.current) {
      handled.current = state.savedAt;
      onDone();
    }
  }, [state, onDone]);

  function recalculate() {
    const qty = Number(quantity);
    const priceNum = Number(price);
    if (!Number.isInteger(qty) || qty <= 0 || price.trim() === "" || !(priceNum >= 0)) {
      setNote("Enter kitta and price first.");
      return;
    }

    if (isSell) {
      const before = sortForReplay(transactions).filter(
        (t) =>
          t.id !== tx.id &&
          (t.transaction_date < date || (t.transaction_date === date && t.id < tx.id))
      );
      let position;
      try {
        position = replay(before);
      } catch {
        setNote("The history before this sale has a problem, so fees can't be recalculated.");
        return;
      }
      if (qty > position.held) {
        setNote(`Only ${position.held} kitta were held before this sale.`);
        return;
      }
      const preview = previewSale(position, qty, toPaisa(priceNum), date, fees);
      setAmounts({
        commission: toAmountString(preview.fees.commission),
        sebon: toAmountString(preview.fees.sebon),
        dp: toAmountString(preview.fees.dp),
        cgt: toAmountString(preview.cgt),
      });
    } else {
      const f = buyFees(type as BuyType, toPaisa(priceNum) * BigInt(qty), fees);
      setAmounts({
        commission: toAmountString(f.commission),
        sebon: toAmountString(f.sebon),
        dp: toAmountString(f.dp),
        cgt: "0.00",
      });
    }
    setNote("Recalculated from your current settings.");
  }

  return (
    <form action={formAction} className="form">
      <h2>Edit {isSell ? "sale" : "buy"}</h2>
      <input type="hidden" name="id" value={tx.id} />

      <div className="form-row">
        {isSell ? (
          <div className="field">
            Type
            <input type="hidden" name="type" value="SELL" />
            <span className="static-value">Sell</span>
          </div>
        ) : (
          <label className="field">
            Type
            <select name="type" value={type} onChange={(e) => setType(e.target.value as BuyType)}>
              {(Object.keys(BUY_LABELS) as BuyType[]).map((t) => (
                <option key={t} value={t}>
                  {BUY_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Date
          <input
            name="date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          Kitta
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Price per share (Rs)
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
      </div>

      <div className={isSell ? "form-row" : "form-row three"}>
        <label className="field">
          Commission
          <input
            name="commission"
            type="number"
            min="0"
            step="0.01"
            value={amounts.commission}
            onChange={(e) => setAmounts({ ...amounts, commission: e.target.value })}
          />
        </label>
        <label className="field">
          SEBON fee
          <input
            name="sebon_fee"
            type="number"
            min="0"
            step="0.01"
            value={amounts.sebon}
            onChange={(e) => setAmounts({ ...amounts, sebon: e.target.value })}
          />
        </label>
        <label className="field">
          DP charge
          <input
            name="dp_charge"
            type="number"
            min="0"
            step="0.01"
            value={amounts.dp}
            onChange={(e) => setAmounts({ ...amounts, dp: e.target.value })}
          />
        </label>
        {isSell && (
          <label className="field">
            Capital gains tax
            <input
              name="cgt"
              type="number"
              min="0"
              step="0.01"
              value={amounts.cgt}
              onChange={(e) => setAmounts({ ...amounts, cgt: e.target.value })}
            />
          </label>
        )}
      </div>

      <div>
        <button className="link small" type="button" onClick={recalculate}>
          Recalculate fees{isSell ? " and tax" : ""}
        </button>
        {note && <p className="muted small form-note">{note}</p>}
      </div>

      <label className="field">
        Notes (optional)
        <input name="notes" maxLength={200} defaultValue={tx.notes ?? ""} />
      </label>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-actions">
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const initialDelete: DeleteState = { error: null };

export function DeleteTransaction({ id, label }: { id: number; label: string }) {
  const [state, formAction, pending] = useActionState(deleteTransaction, initialDelete);

  return (
    <form
      action={formAction}
      className="inline-form"
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${label}? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="link small danger" type="submit" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error && (
        <p className="error small" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}