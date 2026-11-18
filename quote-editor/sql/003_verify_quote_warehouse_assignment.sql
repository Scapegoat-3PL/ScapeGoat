-- Fail closed for newly created rate-card edit tokens. The warehouse receiving
-- a quote must actually be the selected warehouse for this Hawk ID, not an
-- arbitrary UUID supplied by a workflow or browser. Existing customer/warehouse
-- source tables are only read, never modified.
begin;
create or replace function public.sg_oq_source_guard()
returns trigger language plpgsql set search_path=''
as $$
begin
  if not (
    exists (select 1 from public."VacancyChain" v where v.lead_id=new.hwk_id and v.warehouse_id=new.warehouse_id)
    or exists (select 1 from public."Hawkish" h where h.lead_id=new.hwk_id and h.warehouse_id=new.warehouse_id)
  ) then
    raise exception 'Rate card warehouse is not assigned to this Hawk ID';
  end if;
  return new;
end;
$$;
revoke all on function public.sg_oq_source_guard() from public,anon,authenticated;
drop trigger if exists sg_oq_source_guard_t on public.sg_opportunity_rate_quotes;
create trigger sg_oq_source_guard_t
before insert on public.sg_opportunity_rate_quotes
for each row execute function public.sg_oq_source_guard();
commit;