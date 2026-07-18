-- Jalankan SETELAH membuat user admin di:
-- Supabase > Authentication > Users > Add user
-- Ganti email di bawah jika Anda memakai email lain.

insert into public.admin_profiles (user_id, full_name, role, is_active)
select id, 'Septino, QWP®, CIS®', 'super_admin', true
from auth.users
where lower(email) = lower('admin@cerdasfinansial.id')
on conflict (user_id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

select ap.user_id, ap.full_name, ap.role, ap.is_active, u.email
from public.admin_profiles ap
join auth.users u on u.id = ap.user_id
where lower(u.email) = lower('admin@cerdasfinansial.id');
