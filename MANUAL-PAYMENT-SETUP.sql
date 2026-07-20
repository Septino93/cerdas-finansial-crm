-- Jalankan sekali di Supabase SQL Editor
-- Membuat layanan teknis tersembunyi untuk tagihan manual CRM.
insert into public.services (slug, name, description, price, uses_credit, is_active, sort_order)
select 'tagihan-manual', 'Tagihan Manual', 'Layanan teknis untuk tagihan custom dari CRM', 0, false, false, 999
where not exists (select 1 from public.services where slug='tagihan-manual');

select 'Manual Payment siap digunakan' as result;
