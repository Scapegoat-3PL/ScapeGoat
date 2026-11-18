-- Additive Opportunity Rate Card Editor v1 migration.
-- Approved for existing Scapegoat Supabase project: new sg_opportunity_rate_* tables only.
-- No paid database branch; no changes to existing quote-generator, warehouse or blanket-rate tables.
-- Public Data API remains locked: service_role-only access behind Cloudflare Worker.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.sg_opportunity_rate_quotes (
  quote_id uuid primary key default gen_random_uuid(),
  hwk_id text not null check (length(hwk_id) between 4 and 100),
  warehouse_id uuid not null references public.warehouses(warehouse_id),
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft','ready_to_publish','finalized','published','superseded')),
  baseline_payload jsonb not null check (jsonb_typeof(baseline_payload)='object'),
  draft_payload jsonb not null check (jsonb_typeof(draft_payload)='object'),
  editor_source text not null default 'n8n-generator',
  finalized_at timestamptz,
  final_html text,
  constraint sg_oq_finalized_complete check (status <> 'finalized' or (finalized_at is not null and final_html is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sg_oq_hwk_wh_idx on public.sg_opportunity_rate_quotes(hwk_id,warehouse_id);
create table if not exists public.sg_opportunity_rate_quote_links (
  link_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sg_opportunity_rate_quotes(quote_id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  issued_at timestamptz not null default now()
);
create index if not exists sg_oq_links_quote_idx on public.sg_opportunity_rate_quote_links(quote_id);
create table if not exists public.sg_opportunity_rate_quote_versions (
  quote_id uuid not null references public.sg_opportunity_rate_quotes(quote_id) on delete cascade,
  revision integer not null,
  status text not null,
  snapshot jsonb not null,
  editor_source text not null,
  recorded_at timestamptz not null default now(),
  primary key (quote_id,revision)
);
create or replace function public.sg_oq_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.quote_id is distinct from old.quote_id or
     new.hwk_id is distinct from old.hwk_id or
     new.warehouse_id is distinct from old.warehouse_id or
     new.baseline_payload is distinct from old.baseline_payload then
      raise exception 'Quote identity and baseline are immutable';
  end if;
  if old.status = 'finalized' then raise exception 'Finalized quotes are immutable'; end if;
  if new.revision <> old.revision+1 then raise exception 'Quote revision must increment by exactly one'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create or replace function public.sg_oq_audit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  insert into public.sg_opportunity_rate_quote_versions(quote_id,revision,status,snapshot,editor_source)
  values(new.quote_id,new.revision,new.status,jsonb_build_object('draft',new.draft_payload,'finalized_at',new.finalized_at,'html_sha256',case when new.final_html is null then null else encode(extensions.digest(new.final_html,'sha256'),'hex') end),new.editor_source);
  return null;
end;
$$;
drop trigger if exists sg_oq_guard_t on public.sg_opportunity_rate_quotes;
create trigger sg_oq_guard_t before update on public.sg_opportunity_rate_quotes
for each row execute function public.sg_oq_guard();
drop trigger if exists sg_oq_audit_t on public.sg_opportunity_rate_quotes;
create trigger sg_oq_audit_t after insert or update on public.sg_opportunity_rate_quotes
for each row execute function public.sg_oq_audit();
alter table public.sg_opportunity_rate_quotes enable row level security;
alter table public.sg_opportunity_rate_quote_links enable row level security;
alter table public.sg_opportunity_rate_quote_versions enable row level security;
revoke all on public.sg_opportunity_rate_quotes from public,anon,authenticated;
revoke all on public.sg_opportunity_rate_quote_links from public,anon,authenticated;
revoke all on public.sg_opportunity_rate_quote_versions from public,anon,authenticated;
revoke all on function public.sg_oq_guard() from public,anon,authenticated;
revoke all on function public.sg_oq_audit() from public,anon,authenticated;
grant select, insert, update on public.sg_opportunity_rate_quotes to service_role;
grant select, insert, update on public.sg_opportunity_rate_quote_links to service_role;
grant select, insert on public.sg_opportunity_rate_quote_versions to service_role;

-- Delivery outbox is staging-only until a separately approved n8n sender is connected.
-- This records requests; it does NOT send messages from SQL.
create table if not exists public.sg_opportunity_rate_quote_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sg_opportunity_rate_quotes(quote_id),
  revision integer not null check (revision > 0),
  channel text not null check(channel in ('customer','warehouse')),
  recipient_email text not null check(length(recipient_email) between 5 and 320),
  status text not null default 'pending' check(status in ('pending','accepted','sent','failed')),
  provider_message_id text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  sent_at timestamptz,
  failure_reason text,
  unique(quote_id,revision,channel)
);
create index if not exists sg_quote_delivery_status_idx on public.sg_opportunity_rate_quote_deliveries(status,requested_at);
alter table public.sg_opportunity_rate_quote_deliveries enable row level security;
revoke all on public.sg_opportunity_rate_quote_deliveries from public,anon,authenticated;
grant select,insert,update on public.sg_opportunity_rate_quote_deliveries to service_role;

commit;
