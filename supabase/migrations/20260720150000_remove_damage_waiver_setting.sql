-- Damage waiver removed (owner decision, 20 Jul 2026): the trial waiver line
-- was never confirmed as policy — damage is billed directly via the damage
-- charges schedule (BUSINESS_RULES §1.6). No rental ever carried a waiver.
delete from settings where key = 'damage_waiver_pct';
