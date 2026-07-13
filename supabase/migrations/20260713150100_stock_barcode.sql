-- Barcodes for the shop till: each stock item can carry the EAN/UPC from
-- its packaging, so the POS scan box resolves a scanner beep straight to
-- the item (falling back to item_code / name matching as before).

alter table stock_items
  add column if not exists barcode text;

create index if not exists stock_items_barcode_idx
  on stock_items (barcode) where barcode is not null;
