export interface ParsedHolding {
  symbol: string;
  quantity: number;
  wacc: number | null;
  waccQuantity: number | null;
  waccDate: string | null;
}

export type ParseResult = { holdings: ParsedHolding[]; notes: string[] } | { error: string };

const SYMBOL = /^[A-Z0-9]{1,20}$/;

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inQuotes) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function columns(header: string[]) {
  const index = new Map(header.map((name, i) => [name.trim().toLowerCase(), i]));
  return (name: string) => index.get(name.toLowerCase()) ?? -1;
}

function detect(header: string[]): "shares" | "wacc" | null {
  const names = header.map((h) => h.trim().toLowerCase());
  if (names.includes("scrip") && names.includes("current balance")) return "shares";
  if (names.includes("scrip name") && names.includes("wacc rate")) return "wacc";
  return null;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function parseSnapshotFiles(texts: string[]): ParseResult {
  let shares: string[][] | null = null;
  let wacc: string[][] | null = null;

  for (const text of texts) {
    const rows = parseCsv(text);
    if (rows.length === 0) return { error: "One of the files is empty." };
    const kind = detect(rows[0]);
    if (!kind) {
      return { error: "One file isn't a Meroshare shares or WACC export. Check that you picked the right files." };
    }
    if (kind === "shares") {
      if (shares) return { error: "You picked two shares files. Pick one shares file and one WACC report." };
      shares = rows;
    } else {
      if (wacc) return { error: "You picked two WACC reports. Pick one shares file and one WACC report." };
      wacc = rows;
    }
  }

  if (!shares) {
    return { error: "The shares file (My Shares Values) is missing. It's the one that lists what you hold." };
  }

  const notes: string[] = [];
  const waccBySymbol = new Map<string, { rate: number; quantity: number; date: string | null }>();

  if (wacc) {
    const col = columns(wacc[0]);
    const iSymbol = col("Scrip Name");
    const iQuantity = col("WACC Calculated Quantity");
    const iRate = col("WACC Rate");
    const iDate = col("Last Modification Date");
    if (iSymbol < 0 || iQuantity < 0 || iRate < 0) {
      return { error: "The WACC report is missing some of the columns it normally has." };
    }
    for (const r of wacc.slice(1)) {
      const symbol = (r[iSymbol] ?? "").trim().toUpperCase();
      const rate = toNumber(r[iRate]);
      const quantity = toNumber(r[iQuantity]);
      if (!SYMBOL.test(symbol) || rate === null || rate < 0 || quantity === null || quantity < 0) continue;
      const dateMatch = iDate >= 0 ? (r[iDate] ?? "").trim().match(/^\d{4}-\d{2}-\d{2}/) : null;
      waccBySymbol.set(symbol, { rate, quantity, date: dateMatch ? dateMatch[0] : null });
    }
  } else {
    notes.push("No WACC report was included, so cost and profit can't be shown.");
  }

  const col = columns(shares[0]);
  const iSymbol = col("Scrip");
  const iBalance = col("Current Balance");
  if (iSymbol < 0 || iBalance < 0) {
    return { error: "The shares file is missing some of the columns it normally has." };
  }

  const holdings: ParsedHolding[] = [];
  const seen = new Set<string>();
  for (const r of shares.slice(1)) {
    const symbol = (r[iSymbol] ?? "").trim().toUpperCase();
    const quantity = toNumber(r[iBalance]);
    // Skips the "Total :" row and anything else that isn't a holding.
    if (!SYMBOL.test(symbol) || quantity === null || quantity <= 0 || seen.has(symbol)) continue;
    seen.add(symbol);
    const w = waccBySymbol.get(symbol);
    holdings.push({
      symbol,
      quantity: round4(quantity),
      wacc: w ? round4(w.rate) : null,
      waccQuantity: w ? round4(w.quantity) : null,
      waccDate: w ? w.date : null,
    });
  }

  if (holdings.length === 0) return { error: "No holdings were found in the shares file." };

  const skipped = [...waccBySymbol.keys()].filter((s) => !seen.has(s));
  if (skipped.length > 0) {
    notes.push(`In the WACC report but not in your current holdings, so skipped: ${skipped.join(", ")}.`);
  }
  if (wacc) {
    const missing = holdings.filter((h) => h.wacc === null).map((h) => h.symbol);
    if (missing.length > 0) notes.push(`No WACC found for: ${missing.join(", ")}.`);
  }

  return { holdings, notes };
}