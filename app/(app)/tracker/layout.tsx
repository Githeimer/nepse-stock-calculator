import { Suspense } from "react";
import { StockList, StockListSkeleton } from "./stock-list";

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="split">
      <Suspense fallback={<StockListSkeleton />}>
        <StockList />
      </Suspense>
      <section className="detail">{children}</section>
    </div>
  );
}