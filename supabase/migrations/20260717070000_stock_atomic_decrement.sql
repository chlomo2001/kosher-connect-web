-- A1 (shop oversell) — atomic, guarded stock adjustment.
--
-- The shop sale path validated stock in JS and then wrote `quantity - qty` with
-- a plain PATCH. Two tills selling the last unit both passed the JS check and
-- both wrote, taking stock negative (oversell + lost update). PostgREST can't
-- express `quantity = quantity - q`, so the correct fix is a DB function that
-- does the read-modify-write in one atomic, row-locked statement with a guard.
--
-- adjust_stock_qty(item, delta):
--   • delta < 0  → a sale: succeeds only if enough stock remains (guard below),
--                  otherwise updates no row and returns NULL (caller aborts).
--   • delta > 0  → a compensation/restock: always allowed.
-- Returns the new quantity, or NULL when the guard blocked the change.

create or replace function public.adjust_stock_qty(p_item uuid, p_qty int)
returns int
language sql
volatile
security definer
set search_path = public
as $$
  update public.stock_items
     set quantity = quantity + p_qty,
         updated_at = now()
   where id = p_item
     and quantity + p_qty >= 0
  returning quantity;
$$;

-- Only the trusted API surface (service role) may move stock this way.
revoke all on function public.adjust_stock_qty(uuid, int) from public;
grant execute on function public.adjust_stock_qty(uuid, int) to service_role;
