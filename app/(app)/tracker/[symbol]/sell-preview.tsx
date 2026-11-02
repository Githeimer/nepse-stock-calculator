"use client";
import { useActionState, useState } from "react";
import { recordSale, type SaleState } from "../action";
import { formatRs, toAmountString, toPaisa } from "@/lib/money";
import { formatRate, previewSale } from "@/lib/sell";
import type { Lot } from "@/lib/portfolio";
import type { FeeSettings } from "@/lib/types";
import { Pl } from "@/components/pl";

const initialState: SaleState = { error: null, savedAt: 0 };

interface Props {
  symbol: string;
  held: number;
  costBasis: bigint;
  lots: Lot[];
  ltp: bigint | null;
  fees: FeeSettings | null;
  today: string;
}

function parseAmount(value: string): bigint {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? toPaisa(n) : 0n;
}

export function SellPreview({ symbol, held, costBasis, lots, ltp, fees, today }: Props) {
  const [state, formAction, pending] = useActionState(recordSale, initialState);
  const [quantity, setQuantity] = useState(String(held));
  const [price, setPrice] = useState(ltp !== null ? toAmountString(ltp) : "");
  const [date, setDate] = useState(today);
  const [manual, setManual] = useState(false);
  const [inputs, setInputs] = useState({ commission: "", sebon: "", dp: "", cgt: "" });

  const qty = Number(quantity);
  const priceNum = Number(price);
  const qtyOk = Number.isInteger(qty) && qty >= 1 && qty <= held;
  const priceOk = price.trim() !== "" && Number.isFinite(priceNum) && priceNum > 0;
  const ready = qtyOk && priceOk && date !== "";

  const position = { held, costBasis, lots };
  const pricePaisa = priceOk ? toPaisa(priceNum) : 0n;
  const auto = ready ? previewSale(position, qty, pricePaisa, date, fees) : null;
  const preview =
    ready && manual
      ? previewSale(position, qty, pricePaisa, date, fees, {
          fees: {
            commission: parseAmount(inputs.commission),
            sebon: parseAmount(inputs.sebon),
            dp: parseAmount(inputs.dp),
          },
          cgt: parseAmount(inputs.cgt),
        })
      : auto;

  function toggleManual(on: boolean) {
    setManual(on);
    if (on && auto) {
      setInputs({
        commission: toAmountString(auto.fees.commission),
        sebon: toAmountString(auto.fees.sebon),
        dp: toAmountString(auto.fees.dp),
        cgt: toAmountString(auto.cgt),
      });
    }
  }

  function taxNote(): string {
    if (!preview) return "";
    if (preview.preTaxProfit <= 0n) return "No tax on a loss";
    const parts: string[] = [];
    if (preview.longQty > 0 && fees) parts.push(`${preview.longQty} long-term at ${formatRate(fees.cgt_long_rate)}`);
    if (preview.shortQty > 0 && fees) parts.push(`${preview.shortQty} short-term at ${formatRate(fees.cgt_short_rate)}`);
    return parts.join(", ");
  }

  return (
    <div className="sell">
      <h2>Sell preview</h2>
      <form action={formAction}>
        <input type="hidden" name="symbol" value={symbol} />

        <div className="sell-fields">
          <label className="field">
            Kitta to sell
            <input
              name="quantity"
              type="number"
              min="1"
              max={held}
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Sell price (Rs)
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>
          <label className="field span">
            Sale date
            <input
              name="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <button className="link small span" type="button" onClick={() => setQuantity(String(held))}>
            Sell all {held} kitta
          </button>
        </div>

        {quantity !== "" && !qtyOk && (
          <p className="error small">You hold {held} kitta. Enter a whole number from 1 to {held}.</p>
        )}

        {preview && (
          <div className="bill">
            <table>
              <tbody>
                <tr>
                  <td>
                    Gross amount
                    <span className="sub">
                      {qty} kitta × {formatRs(pricePaisa)}
                    </span>
                  </td>
                  <td className="num">{formatRs(preview.gross)}</td>
                </tr>
                <tr>
                  <td>Broker commission</td>
                  <td className="num">−{formatRs(preview.fees.commission)}</td>
                </tr>
                <tr>
                  <td>SEBON fee</td>
                  <td className="num">−{formatRs(preview.fees.sebon)}</td>
                </tr>
                <tr>
                  <td>DP charge</td>
                  <td className="num">−{formatRs(preview.fees.dp)}</td>
                </tr>
                <tr>
                  <td>
                    Capital gains tax
                    <span className="sub">{taxNote()}</span>
                  </td>
                  <td className="num">−{formatRs(preview.cgt)}</td>
                </tr>
                <tr className="total">
                  <td>You receive</td>
                  <td className="num">{formatRs(preview.net)}</td>
                </tr>
                <tr>
                  <td className="muted">Cost of these kitta</td>
                  <td className="num muted">{formatRs(preview.allocatedCost)}</td>
                </tr>
                <tr className="result">
                  <td>Profit after tax</td>
                  <td className="num">
                    <Pl value={preview.profit} base={preview.allocatedCost} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={manual}
            onChange={(e) => toggleManual(e.target.checked)}
            disabled={!ready}
          />
          Enter amounts from my broker bill
        </label>

        {manual ? (
          <div className="sell-fields">
            <label className="field">
              Commission
              <input
                name="commission"
                type="number"
                min="0"
                step="0.01"
                value={inputs.commission}
                onChange={(e) => setInputs({ ...inputs, commission: e.target.value })}
              />
            </label>
            <label className="field">
              SEBON fee
              <input
                name="sebon_fee"
                type="number"
                min="0"
                step="0.01"
                value={inputs.sebon}
                onChange={(e) => setInputs({ ...inputs, sebon: e.target.value })}
              />
            </label>
            <label className="field">
              DP charge
              <input
                name="dp_charge"
                type="number"
                min="0"
                step="0.01"
                value={inputs.dp}
                onChange={(e) => setInputs({ ...inputs, dp: e.target.value })}
              />
            </label>
            <label className="field">
              Capital gains tax
              <input
                name="cgt"
                type="number"
                min="0"
                step="0.01"
                value={inputs.cgt}
                onChange={(e) => setInputs({ ...inputs, cgt: e.target.value })}
              />
            </label>
          </div>
        ) : (
          preview && (
            <>
              <input type="hidden" name="commission" value={toAmountString(preview.fees.commission)} />
              <input type="hidden" name="sebon_fee" value={toAmountString(preview.fees.sebon)} />
              <input type="hidden" name="dp_charge" value={toAmountString(preview.fees.dp)} />
              <input type="hidden" name="cgt" value={toAmountString(preview.cgt)} />
            </>
          )
        )}

        {state.error && (
          <p className="error small" role="alert">
            {state.error}
          </p>
        )}

        <button className="btn primary sell-save" type="submit" disabled={!ready || pending}>
          {pending ? "Saving…" : "Record this sale"}
        </button>
        <p className="muted small sell-note">
          Nothing is saved until you record the sale.
        </p>
      </form>
    </div>
  );
}