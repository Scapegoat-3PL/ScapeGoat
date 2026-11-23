-- Limit the generated quote editor tables to the backend's exact CRUD needs.
-- All changes are restricted to the four newly introduced sg_opportunity_rate_* tables.
begin;
revoke all privileges on table public.sg_opportunity_rate_quotes from service_role;
revoke all privileges on table public.sg_opportunity_rate_quote_links from service_role;
revoke all privileges on table public.sg_opportunity_rate_quote_versions from service_role;
revoke all privileges on table public.sg_opportunity_rate_quote_deliveries from service_role;
grant select,insert,update on table public.sg_opportunity_rate_quotes to service_role;
grant select,insert,update on table public.sg_opportunity_rate_quote_links to service_role;
grant select,insert on table public.sg_opportunity_rate_quote_versions to service_role;
grant select,insert,update on table public.sg_opportunity_rate_quote_deliveries to service_role;
commit;