-- staff_profiles.email — added out-of-band during development; versioned here
-- so a rebuild-from-migrations (or disaster recovery) does not break login.
-- auth.js (staffProfileFor / staffProfileByEmail) and team.js select/store it,
-- and Google sign-in resolves staff by verified email. Without this column a
-- fresh DB returns an error on the first getUser -> staffProfileFor and nobody
-- can sign in.
alter table staff_profiles add column if not exists email text;
create index if not exists staff_profiles_email_idx on staff_profiles (lower(email));
