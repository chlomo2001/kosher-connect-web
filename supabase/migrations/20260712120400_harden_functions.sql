-- Lock down function execution surface.
-- current_staff_role(): authenticated must keep EXECUTE (RLS policies evaluate
-- it as the querying role), but anon/public should not reach it via /rest/v1/rpc.
revoke execute on function public.current_staff_role() from public, anon;

-- ledger_is_immutable is a trigger function — nobody calls it directly.
revoke execute on function public.ledger_is_immutable() from public, anon, authenticated;
