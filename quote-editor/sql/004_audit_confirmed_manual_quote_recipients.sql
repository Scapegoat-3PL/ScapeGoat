-- Audit the exact address chosen by the warehouse before Aria sends a finalized quote.
-- This changes ONLY the dedicated quote-editor delivery outbox.
begin;
alter table public.sg_opportunity_rate_quote_deliveries
  add column if not exists recipient_source text not null default 'source_record'
    check (recipient_source in ('source_record', 'manually_entered'));
alter table public.sg_opportunity_rate_quote_deliveries
  add column if not exists recipient_confirmed_at timestamptz;
commit;
