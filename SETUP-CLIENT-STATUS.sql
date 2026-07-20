-- Jalankan satu kali di Supabase SQL Editor.
-- Menambahkan status aktif/nonaktif tanpa menghapus data client.

alter table public.clients
  add column if not exists is_active boolean not null default true;

update public.clients
set is_active = true
where is_active is null;

comment on column public.clients.is_active is
  'TRUE = client aktif, FALSE = client dinonaktifkan (soft disable).';
