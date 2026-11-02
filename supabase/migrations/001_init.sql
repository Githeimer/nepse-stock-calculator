begin;

-- ============================================================
-- Stocks you track
-- ============================================================
create table public.stocks (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol        text not null check (symbol = upper(symbol) and length(symbol) between 1 and 20),
  company_name  text,
  created_at    timestamptz not null default now(),
  unique (user_id, symbol),
  unique (id, user_id)
);

-- ============================================================
-- Buys (lots) and sells
-- ============================================================
create table public.transactions (
  id                bigint generated always as identity primary key,
  user_id           uuid not null default auth.uid(),
  stock_id          bigint not null,
  type              text not null check (type in ('BUY', 'IPO', 'RIGHT', 'BONUS', 'SELL')),
  quantity          integer not null check (quantity > 0),
  price_per_share   numeric(12, 2) not null check (price_per_share >= 0),
  transaction_date  date not null,
  commission        numeric(12, 2) not null default 0 check (commission >= 0),
  sebon_fee         numeric(12, 2) not null default 0 check (sebon_fee >= 0),
  dp_charge         numeric(12, 2) not null default 0 check (dp_charge >= 0),
  cgt               numeric(12, 2) not null default 0 check (cgt >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  -- a transaction can only point at a stock owned by the same user
  foreign key (stock_id, user_id) references public.stocks (id, user_id) on delete restrict,
  -- capital gains tax only applies to sells
  check (type = 'SELL' or cgt = 0)
);

create index transactions_replay_idx on public.transactions (stock_id, transaction_date, id);
create index transactions_user_idx on public.transactions (user_id);

-- ============================================================
-- Market prices (shared by tracker and snapshot, one row per symbol)
-- ============================================================
create table public.market_prices (
  symbol          text primary key check (symbol = upper(symbol)),
  ltp             numeric(12, 2) not null check (ltp > 0),
  previous_close  numeric(12, 2) check (previous_close > 0),
  price_time      timestamptz not null,   -- when the price was traded or published
  source          text not null check (source in ('nepse', 'csv', 'manual')),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- Fee and tax rates (one row per user, all editable in settings)
-- ============================================================
create table public.fee_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  commission_tiers  jsonb not null default '[
    {"up_to": 50000,    "rate": 0.0036},
    {"up_to": 500000,   "rate": 0.0033},
    {"up_to": 2000000,  "rate": 0.0031},
    {"up_to": 10000000, "rate": 0.0027},
    {"up_to": null,     "rate": 0.0024}
  ]',
  min_commission    numeric(10, 2) not null default 10,
  sebon_rate        numeric(8, 6)  not null default 0.00015,
  dp_charge         numeric(10, 2) not null default 25,
  cgt_short_rate    numeric(6, 4)  not null default 0.075,
  cgt_long_rate     numeric(6, 4)  not null default 0.05,
  long_term_days    integer        not null default 365,
  updated_at        timestamptz    not null default now()
);

-- ============================================================
-- Meroshare snapshots (each upload is one snapshot)
-- ============================================================
create table public.snapshots (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uploaded_at  timestamptz not null default now(),
  unique (id, user_id)
);

create table public.snapshot_holdings (
  id           bigint generated always as identity primary key,
  snapshot_id  bigint not null,
  user_id      uuid not null default auth.uid(),
  symbol       text not null check (symbol = upper(symbol)),
  quantity     numeric(14, 4) not null check (quantity > 0),
  wacc         numeric(14, 4) not null check (wacc >= 0),
  ltp          numeric(12, 2),
  foreign key (snapshot_id, user_id) references public.snapshots (id, user_id) on delete cascade,
  unique (snapshot_id, symbol)
);

create index snapshot_holdings_user_idx on public.snapshot_holdings (user_id);

-- ============================================================
-- Row Level Security: each user only sees and changes their own rows
-- ============================================================
alter table public.stocks             enable row level security;
alter table public.transactions       enable row level security;
alter table public.market_prices      enable row level security;
alter table public.fee_settings       enable row level security;
alter table public.snapshots          enable row level security;
alter table public.snapshot_holdings  enable row level security;

create policy "own stocks" on public.stocks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own fee settings" on public.fee_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own snapshots" on public.snapshots
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own snapshot holdings" on public.snapshot_holdings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Prices are market data, not personal data: any signed-in user can read and update them.
-- The cron job writes with the secret key, which bypasses RLS.
create policy "read prices" on public.market_prices
  for select to authenticated using (true);

create policy "insert prices" on public.market_prices
  for insert to authenticated with check (true);

create policy "update prices" on public.market_prices
  for update to authenticated using (true) with check (true);

commit;
