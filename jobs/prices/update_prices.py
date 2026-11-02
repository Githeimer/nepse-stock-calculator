# NEPSE prices replace manual and CSV prices; among NEPSE prices, only newer ones win.
import asyncio
import os
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

import psycopg
from nepseman_api import NepseClient

NEPAL = ZoneInfo("Asia/Kathmandu")
FETCH_TIMEOUT_SECONDS = 90
RETRY_DELAY_SECONDS = 20

SYMBOLS_SQL = """
    select symbol from public.stocks
    union
    select distinct symbol from public.snapshot_holdings
"""

# Only replace a stored price with a newer one.
UPSERT_SQL = """
    insert into public.market_prices (symbol, ltp, previous_close, price_time, source, updated_at)
    values (%s, %s, %s, %s, 'nepse', now())
    on conflict (symbol) do update
       set ltp = excluded.ltp,
           previous_close = excluded.previous_close,
           price_time = excluded.price_time,
           source = excluded.source,
           updated_at = now()
        where market_prices.source <> 'nepse'
        or market_prices.price_time < excluded.price_time
"""


def log(message: str) -> None:
    print(f"{datetime.now(NEPAL):%Y-%m-%d %H:%M:%S} {message}", flush=True)


def to_price(value) -> Decimal | None:
    if value is None:
        return None
    try:
        price = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    return price if price > 0 else None


def to_time(value) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    # NEPSE timestamps have no time zone; they are Nepal time.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=NEPAL)


async def fetch_rows() -> list[dict]:
    async with NepseClient() as nepse:
        try:
            log(f"Market open: {await nepse.is_market_open()}")
        except Exception as error:
            log(f"Couldn't read market status ({error!r}), continuing")
        rows = await nepse.today_price()
    if isinstance(rows, dict):
        rows = rows.get("content", [])
    return rows or []


async def fetch_with_retry() -> list[dict]:
    for attempt in (1, 2):
        try:
            return await asyncio.wait_for(fetch_rows(), FETCH_TIMEOUT_SECONDS)
        except Exception as error:
            log(f"Fetch attempt {attempt} failed: {error!r}")
            if attempt == 1:
                await asyncio.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError("Could not fetch prices from NEPSE")


def connect(url: str) -> psycopg.Connection:
    return psycopg.connect(url, connect_timeout=15, prepare_threshold=None)


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        log("DATABASE_URL is not set")
        return 1

    with connect(url) as conn:
        symbols = {row[0].upper() for row in conn.execute(SYMBOLS_SQL).fetchall()}

    if not symbols:
        log("No tracked symbols, nothing to do")
        return 0

    try:
        rows = asyncio.run(fetch_with_retry())
    except RuntimeError as error:
        log(str(error))
        return 1

    updates = []
    for row in rows:
        symbol = str(row.get("symbol") or "").upper()
        if symbol not in symbols:
            continue
        ltp = to_price(row.get("closePrice")) or to_price(row.get("lastUpdatedPrice"))
        price_time = to_time(row.get("lastUpdatedTime"))
        if ltp is None or price_time is None:
            continue
        updates.append((symbol, ltp, to_price(row.get("previousDayClosePrice")), price_time))

    changed = 0
    if updates:
        with connect(url) as conn, conn.transaction():
            for params in updates:
                changed += conn.execute(UPSERT_SQL, params).rowcount

    log(
        f"{len(symbols)} symbols tracked, {len(updates)} found in today's prices, "
        f"{changed} updated"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())