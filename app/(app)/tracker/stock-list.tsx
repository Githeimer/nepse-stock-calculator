import { connection } from "next/server";
import { getTrackerData, portfolioTotals, todayInNepal } from "@/lib/data";
import { formatPct, formatRs } from "@/lib/money";
import { Pl } from "@/components/pl";
import { StockLink } from "./stock-link";
import { AddBuy } from "./add-buy";

export async function StockList() {
  await connection();
  const { holdings, fees } = await getTrackerData();
  const totals = portfolioTotals(holdings);

  return (
    <aside className="list">
      <div className="list-total">
        <span className="muted small">Portfolio value</span>
        <strong>Rs {formatRs(totals.value)}</strong>
        {totals.pricedCost > 0n && <Pl value={totals.unrealized} base={totals.pricedCost} />}
        {totals.unpriced > 0 && (
          <span className="muted small">
            {totals.unpriced} {totals.unpriced === 1 ? "stock has" : "stocks have"} no price yet
          </span>
        )}
      </div>

      {holdings.length === 0 ? (
        <p className="list-empty muted">No stocks yet.</p>
      ) : (
        <ul>
          {holdings.map((h) => (
            <li key={h.id}>
              <StockLink symbol={h.symbol}>
                <span className="list-sym">{h.symbol}</span>
                <span className="num">{h.ltp !== null ? formatRs(h.ltp) : "—"}</span>
                <span className="list-sub muted">
                  {h.summary.held > 0 ? `${h.summary.held} kitta` : "Sold out"}
                </span>
                <span
                  className={`list-sub num ${
                    h.unrealizedPct === null ? "" : h.unrealizedPct < 0 ? "loss" : "gain"
                  }`}
                >
                  {h.unrealizedPct !== null && h.summary.held > 0 ? formatPct(h.unrealizedPct) : ""}
                </span>
              </StockLink>
            </li>
          ))}
        </ul>
      )}

      <div className="list-actions">
        <AddBuy fees={fees} symbols={holdings.map((h) => h.symbol)} today={todayInNepal()} />
      </div>
    </aside>
  );
}

export function StockListSkeleton() {
  return (
    <aside className="list">
      <div className="list-total">
        <span className="muted small">Portfolio value</span>
        <strong className="muted">…</strong>
      </div>
      <p className="list-empty muted">Loading stocks…</p>
    </aside>
  );
}