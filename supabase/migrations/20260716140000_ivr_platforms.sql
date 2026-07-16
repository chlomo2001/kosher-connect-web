-- IVR / virtual-number providers: the editable list of platforms a virtual
-- number can be provisioned on (feature #10). Previously hard-coded to
-- elid/FreePBX/Other in the app; now an owner-managed CSV so a new provider
-- can be added without a code change. Stored as a CSV settings row so it
-- rides the existing settings plumbing (same pattern as helper_tabs).

insert into settings (key, text_value, description) values (
  'ivr_platforms',
  'elid,FreePBX,Other',
  'IVR / phone providers a virtual number can use (owner-managed)'
) on conflict (key) do nothing;
