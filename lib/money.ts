export type Paisa = bigint;

export function toPaisa(value: number | string): Paisa {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Not a valid amount: ${value}`);
  }
  return BigInt(Math.round(n * 100));
}

export function paisaToNumber(p: Paisa): number {
  return Number(p) / 100;
}

// Rounds half away from zero.
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("Division by zero");
  const negative = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (2n * ad);
  return negative ? -q : q;
}

export function formatRs(p: Paisa): string {
  return paisaToNumber(p).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSigned(p: Paisa): string {
  return (p < 0n ? "−" : "+") + formatRs(p < 0n ? -p : p);
}

export function formatPct(value: number): string {
  return (value < 0 ? "−" : "+") + Math.abs(value).toFixed(2) + "%";
}

export function toAmountString(p: Paisa): string {
  return paisaToNumber(p).toFixed(2);
}