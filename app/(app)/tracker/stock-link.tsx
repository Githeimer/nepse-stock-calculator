"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export function StockLink({ symbol, children }: { symbol: string; children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const current = segment !== null && decodeURIComponent(segment).toUpperCase() === symbol;

  return (
    <Link href={`/tracker/${symbol}`} className="list-item" aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}