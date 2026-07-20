-- PROFILE FINAL FIX
-- Jalankan satu kali di Supabase > SQL Editor.
-- Policy SELECT yang lama boleh tetap dipakai.

alter table public.admin_profiles enable row level security;

drop policy if exists admin_update_own_profile on public.admin_profiles;
create policy admin_update_own_profile
on public.admin_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists admin_insert_own_profile on public.admin_profiles;
create policy admin_insert_own_profile
on public.admin_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

-- Pastikan akun yang login boleh membaca profilnya sendiri.
-- Ini menggantikan policy lama dengan definisi yang pasti benar.
drop policy if exists admin_read_own_profile on public.admin_profiles;
create policy admin_read_own_profile
on public.admin_profiles
for select
to authenticated
using (auth.uid() = user_id);
