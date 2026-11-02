import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTrackerData, todayInNepal } from "@/lib/data";
import { formatRs, toPaisa, type Paisa } from "@/lib/money";
import { Pl } from "@/components/pl";
import { TrackThis } from "./track-this";

interface SnapshotRow {
  symbol: string;
  quantity: number;
  wacc: number | null;
  wacc_quantity: number | null;
  wacc_date: string | null;
}

function rupees(n: number): Paisa {
  return BigInt(Math.round(n * 100));
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(parseFloat(q.toFixed(4)));
}

function formatUploaded(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function SnapshotView() {
  await connection();
  const supabase = await createClient();

  const { data: snapshot, error } = await supabase
    .from("snapshots")
    .select("id, uploaded_at, snapshot_holdings(symbol, quantity, wacc, wacc_quantity, wacc_date)")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return <p className="error">Couldn't load the snapshot: {error.message}</p>;
  if (!snapshot) {
    return <p className="muted">No snapshot yet. Upload your Meroshare files to see your whole portfolio.</p>;
  }

  const holdings = ([...(snapshot.snapshot_holdings ?? [])] as SnapshotRow[]).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  const [pricesResult, tracker] = await Promise.all([
    supabase.from("market_prices").select("symbol, ltp").in(
      "symbol",
      holdings.map((h) => h.symbol)
    ),
    getTrackerData(),
  ]);
  if (pricesResult.error) return <p className="error">Couldn't load prices: {pricesResult.error.message}</p>;

  const ltpBySymbol = new Map(
    (pricesResult.data ?? []).map((p) => [p.symbol as string, toPaisa(p.ltp as number)])
  );
  const trackedHeld = new Map(tracker.holdings.map((h) => [h.symbol, h.summary.held]));
  const today = todayInNepal();

  let cost: Paisa = 0n;
  let value: Paisa = 0n;
  let unrealizedTotal: Paisa = 0n;
  let comparableCost: Paisa = 0n;
  let unpriced = 0;
  let withoutWacc = 0;

  const rows = holdings.map((h) => {
    const ltp = ltpBySymbol.get(h.symbol) ?? null;
    const rowValue = ltp !== null ? BigInt(Math.round(Number(ltp) * h.quantity)) : null;
    const rowCost = h.wacc !== null ? rupees(h.wacc * h.quantity) : null;
    const unrealized = rowCost !== null && rowValue !== null ? rowValue - rowCost : null;

    if (rowCost !== null) cost += rowCost;
    else withoutWacc += 1;
    if (rowValue !== null) value += rowValue;
    else unpriced += 1;
    if (unrealized !== null && rowCost !== null) {
      unrealizedTotal += unrealized;
      comparableCost += rowCost;
    }

    return { ...h, ltp, rowValue, rowCost, unrealized };
  });

  return (
    <>
      <p className="muted small">
        Uploaded {formatUploaded(snapshot.uploaded_at)}, {holdings.length} stocks
      </p>

      <dl className="facts">
        <div>
          <dt>Cost (WACC)</dt>
          <dd>Rs {formatRs(cost)}</dd>
        </div>
        <div>
          <dt>Value at LTP</dt>
          <dd>Rs {formatRs(value)}</dd>
        </div>
        <div>
          <dt>Unrealized</dt>
          <dd>{comparableCost > 0n ? <Pl value={unrealizedTotal} base={comparableCost} /> : "—"}</dd>
        </div>
      </dl>

      {unpriced > 0 && (
        <p className="muted small">
          {unpriced} {unpriced === 1 ? "stock has" : "stocks have"} no price yet. Prices fill in at the
          next price update.
        </p>
      )}
      {withoutWacc > 0 && (
        <p className="muted small">
          {withoutWacc} {withoutWacc === 1 ? "stock has" : "stocks have"} no WACC, so cost and profit
          leave {withoutWacc === 1 ? "it" : "them"} out.
        </p>
      )}

      <div className="table-wrap">
        <table className="data snap-table">
          <thead>
            <tr>
              <th>Scrip</th>
              <th className="num">Kitta</th>
              <th className="num">WACC</th>
              <th className="num">LTP</th>
              <th className="num">Value</th>
              <th className="num">Cost</th>
              <th className="num">Unrealized</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const held = trackedHeld.get(r.symbol);
              return (
                <tr key={r.symbol}>
                  <td>{r.symbol}</td>
                  <td className="num">{formatQty(r.quantity)}</td>
                  <td className="num">
                    {r.wacc !== null ? formatRs(rupees(r.wacc)) : "—"}
                    {r.wacc_quantity !== null && r.wacc_quantity !== r.quantity && (
                      <span className="muted small"> (for {formatQty(r.wacc_quantity)})</span>
                    )}
                  </td>
                  <td className="num">{r.ltp !== null ? formatRs(r.ltp) : "—"}</td>
                  <td className="num">{r.rowValue !== null ? formatRs(r.rowValue) : "—"}</td>
                  <td className="num">{r.rowCost !== null ? formatRs(r.rowCost) : "—"}</td>
                  <td className="num">
                    {r.unrealized !== null && r.rowCost !== null ? (
                      <Pl value={r.unrealized} base={r.rowCost} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="snap-action">
                    {held !== undefined ? (
                      <>
                        <Link href={`/tracker/${r.symbol}`}>Tracked</Link>
                        {held !== r.quantity && <span className="muted small"> (tracker: {held})</span>}
                      </>
                    ) : r.wacc === null ? (
                      <span className="muted small">No WACC</span>
                    ) : !Number.isInteger(r.quantity) ? (
                      <span className="muted small">Fractional kitta</span>
                    ) : (
                      <TrackThis
                        symbol={r.symbol}
                        quantity={r.quantity}
                        wacc={r.wacc}
                        today={today}
                        defaultDate={r.wacc_date && r.wacc_date <= today ? r.wacc_date : today}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}