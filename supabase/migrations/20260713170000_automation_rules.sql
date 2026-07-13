-- Owner-defined automation rules (#20). These run inside the daily sweep on
-- top of the built-in ones, letting the owner add "when X, do Y" without a
-- code change. MVP action is 'create_task'; SMS/email actions arrive with
-- Twilio (Phase 2).
--
-- trigger        one of: balance_over | rental_overdue_days | flight_in_days
--                | passport_in_days | sim_renewal_in_days | checkin_due
-- threshold      the rule's number — £ for balance_over, otherwise N days
-- task_title     title template; {name} → customer name, {n} → the value
create table if not exists automation_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trigger     text not null,
  threshold   numeric,
  action      text not null default 'create_task',
  task_title  text,
  priority    text not null default 'high',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table automation_rules enable row level security;
create policy automation_rules_owner_all on automation_rules
  for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');
