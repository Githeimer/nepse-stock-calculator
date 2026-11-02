import { connection } from "next/server";
import { daysBetween, getTrackerData, todayInNepal } from "@/lib/data";
import { formatRs } from "@/lib/money";
import { Pl } from "@/components/pl";

const TYPE_LABELS = { BUY: "Buy", IPO: "IPO", RIGHT: "Right", BONUS: "Bonus", SELL: "Sell" } as const;

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPriceTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  await connection();
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { holdings, fees } = await getTrackerData();
  const h = holdings.find((x) => x.symbol === symbol);

  if (!h) {
    return (
      <>
        <h1>{symbol}</h1>
        <p className="muted">You don't track {symbol} yet. Use Add buy to record a purchase.</p>
      </>
    );
  }

  const today = todayInNepal();
  const longTermDays = fees?.long_term_days ?? 365;
  const s = h.summary;

  return (
    <>
      <header className="detail-head">
        <div>
          <h1>{h.symbol}</h1>
          {h.companyName && <p className="muted">{h.companyName}</p>}
        </div>
        <div className="ltp">
          {h.ltp !== null && h.price ? (
            <>
              <span className="muted">LTP</span>
              <strong>{formatRs(h.ltp)}</strong>
              <span className="muted small">as of {formatPriceTime(h.price.price_time)}</span>
            </>
          ) : (
            <span className="muted">No price yet</span>
          )}
        </div>
      </header>

      {h.problem && (
        <p className="error" role="alert">
          {h.problem}
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Kitta held</dt>
          <dd>{s.held}</dd>
        </div>
        <div>
          <dt>Avg cost (WACC)</dt>
          <dd>{s.wacc !== null ? formatRs(s.wacc) : "—"}</dd>
        </div>
        <div>
          <dt>Cost basis</dt>
          <dd>{formatRs(s.costBasis)}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd>{h.marketValue !== null ? formatRs(h.marketValue) : "—"}</dd>
        </div>
        <div>
          <dt>Unrealized</dt>
          <dd>{h.unrealized !== null ? <Pl value={h.unrealized} base={s.costBasis} /> : "—"}</dd>
        </div>
        <div>
          <dt>Realized</dt>
          <dd>
            <Pl value={s.realized} />
          </dd>
        </div>
      </dl>

      <h2>Lots</h2>
      {s.lots.length === 0 ? (
        <p className="muted">No shares held.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Bought</th>
                <th>Type</th>
                <th className="num">Kitta</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
                <th>Held</th>
              </tr>
            </thead>
            <tbody>
              {s.lots.map((lot) => {
                const days = daysBetween(lot.date, today);
                return (
                  <tr key={lot.txId}>
                    <td>{formatDate(lot.date)}</td>
                    <td>{TYPE_LABELS[lot.type]}</td>
                    <td className="num">
                      {lot.remainingQty < lot.originalQty
                        ? `${lot.remainingQty} of ${lot.originalQty}`
                        : lot.remainingQty}
                    </td>
                    <td className="num">{formatRs(lot.price)}</td>
                    <td className="num">{formatRs(lot.price * BigInt(lot.remainingQty))}</td>
                    <td className="muted">
                      {days} days{days > longTermDays ? ", long-term" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function StockDetailSkeleton() {
  return (
    <>
      <h1 className="muted">…</h1>
      <p className="muted">Loading stock…</p>
    </>
  );
}