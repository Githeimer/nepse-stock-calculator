import { connection } from "next/server";
import { getTrackerData, portfolioTotals } from "@/lib/data";
import { formatRs } from "@/lib/money";
import { Pl } from "@/components/pl";

export async function Overview() {
  await connection();
  const { holdings } = await getTrackerData();

  if (holdings.length === 0) {
    return <p className="muted">No stocks yet. Use Add buy to record your first purchase.</p>;
  }

  const t = portfolioTotals(holdings);

  return (
    <>
      <dl className="facts">
        <div>
          <dt>Stocks held</dt>
          <dd>{t.stocksHeld}</dd>
        </div>
        <div>
          <dt>Kitta</dt>
          <dd>{t.kitta}</dd>
        </div>
        <div>
          <dt>Cost of holdings</dt>
          <dd>Rs {formatRs(t.cost)}</dd>
        </div>
        <div>
          <dt>Value at LTP</dt>
          <dd>Rs {formatRs(t.value)}</dd>
        </div>
        <div>
          <dt>Unrealized</dt>
          <dd>{t.pricedCost > 0n ? <Pl value={t.unrealized} base={t.pricedCost} /> : "—"}</dd>
        </div>
        <div>
          <dt>Realized</dt>
          <dd>
            <Pl value={t.realized} />
          </dd>
        </div>
      </dl>
      {t.unpriced > 0 && (
        <p className="muted small">
          Value and unrealized profit leave out {t.unpriced}{" "}
          {t.unpriced === 1 ? "stock that has" : "stocks that have"} no price yet.
        </p>
      )}
      <p className="muted">Select a stock to see its lots and dates.</p>
    </>
  );
}

export function OverviewSkeleton() {
  return <p className="muted">Loading portfolio…</p>;
}