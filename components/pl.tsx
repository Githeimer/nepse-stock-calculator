import { formatPct, formatSigned, type Paisa } from "@/lib/money";

export function Pl({ value, base }: { value: Paisa; base?: Paisa }) {
  const pct = base !== undefined && base !== 0n ? (Number(value) / Number(base)) * 100 : null;
  return (
    <span className={value < 0n ? "loss" : "gain"}>
      {formatSigned(value)}
      {pct !== null && <small> ({formatPct(pct)})</small>}
    </span>
  );
}