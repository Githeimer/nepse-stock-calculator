begin;

alter table public.snapshot_holdings alter column wacc drop not null;
alter table public.snapshot_holdings add column wacc_quantity numeric(14, 4) check (wacc_quantity >= 0);
alter table public.snapshot_holdings drop column ltp;

commit;