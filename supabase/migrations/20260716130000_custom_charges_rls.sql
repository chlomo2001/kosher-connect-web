-- audit U7 — custom_charges had no row-level security, unlike its sibling tables,
-- so with the anon/publishable key it was directly readable and writable. It
-- drives auto-applied money charges (extra fees), so tampering affects billing.
-- Enable RLS and restrict all access to authenticated staff, mirroring
-- service_orders_staff_all. (The server uses the service-role key and bypasses
-- RLS, so the operator API is unaffected.)
alter table custom_charges enable row level security;

create policy custom_charges_staff_all on custom_charges
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
