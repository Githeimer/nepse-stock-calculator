import { connection } from "next/server";
import { daysBetween, getTrackerData, todayInNepal } from "@/lib/data";
import { formatRs } from "@/lib/money";
import { Pl } from "@/components/pl";
import { PriceEditor } from "./price-editor";
import { SellPreview } from "./sell-preview";

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
          <PriceEditor key={h.price?.price_time ?? "none"} symbol={h.symbol} ltp={h.ltp} />
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

      <div className="detail-cols">
        <div>
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

          {s.sales.length > 0 && (
            <>
              <h2 className="section-gap">Sales</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Sold</th>
                      <th className="num">Kitta</th>
                      <th className="num">Price</th>
                      <th className="num">Received</th>
                      <th className="num">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.sales].reverse().map((sale) => (
                      <tr key={sale.txId}>
                        <td>{formatDate(sale.date)}</td>
                        <td className="num">{sale.quantity}</td>
                        <td className="num">{formatRs(sale.price)}</td>
                        <td className="num">{formatRs(sale.net)}</td>
                        <td className="num">
                          <Pl value={sale.realized} base={sale.allocatedCost} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {s.held > 0 && !h.problem ? (
          <SellPreview
            key={`${s.held}-${s.costBasis}-${h.ltp ?? "none"}`}
            symbol={h.symbol}
            held={s.held}
            costBasis={s.costBasis}
            lots={s.lots}
            ltp={h.ltp}
            fees={fees}
            today={today}
          />
        ) : (
          <div className="sell">
            <h2>Sell preview</h2>
            <p className="muted">No shares to sell.</p>
          </div>
        )}
      </div>
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