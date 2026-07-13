-- Helper visibility: which tabs a helper role can open. Owner edits the
-- list from the Team card; owners always see everything. Stored as a CSV
-- settings row so it rides the existing settings plumbing.

insert into settings (key, text_value, description) values (
  'helper_tabs',
  'dashboard,customers,rentals,sim,wallet,bookings,repairs,services,shop,virtual,tasks,settings',
  'Tabs a helper can open (owner-managed)'
) on conflict (key) do nothing;
