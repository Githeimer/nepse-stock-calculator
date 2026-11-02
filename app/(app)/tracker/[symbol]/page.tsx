import { Suspense } from "react";
import { StockDetail, StockDetailSkeleton } from "./stock-detail";

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  return (
    <Suspense fallback={<StockDetailSkeleton />}>
      <StockDetail params={params} />
    </Suspense>
  );
}