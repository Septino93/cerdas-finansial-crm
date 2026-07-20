-- CERDAS FINANSIAL CRM STAGE 7 - DOCUMENT STORAGE
-- Jalankan satu kali di Supabase SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit)
values ('client-documents', 'client-documents', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "Authenticated admin can upload client documents" on storage.objects;
create policy "Authenticated admin can upload client documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'client-documents');

drop policy if exists "Authenticated admin can update client documents" on storage.objects;
create policy "Authenticated admin can update client documents"
on storage.objects for update to authenticated
using (bucket_id = 'client-documents') with check (bucket_id = 'client-documents');

drop policy if exists "Authenticated admin can delete client documents" on storage.objects;
create policy "Authenticated admin can delete client documents"
on storage.objects for delete to authenticated
using (bucket_id = 'client-documents');

drop policy if exists "Public can read client documents" on storage.objects;
create policy "Public can read client documents"
on storage.objects for select to public
using (bucket_id = 'client-documents');
