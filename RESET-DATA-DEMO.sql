-- Cerdas Finansial CRM — Reset Data Demo
-- Jalankan satu kali di Supabase > SQL Editor sebelum memakai menu Reset Data Demo.
-- Fungsi ini hanya dapat dipanggil oleh admin aktif dengan role super_admin.

create or replace function public.reset_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clients bigint := 0;
  v_consultations bigint := 0;
  v_payments bigint := 0;
  v_activities bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan.';
  end if;

  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.is_active = true
      and ap.role = 'super_admin'
  ) then
    raise exception 'Hanya super admin aktif yang boleh mereset data demo.';
  end if;

  select count(*) into v_activities from public.activity_logs;
  select count(*) into v_payments from public.payments;
  select count(*) into v_consultations from public.consultations;
  select count(*) into v_clients from public.clients;

  -- Urutan dari tabel anak ke tabel induk untuk menjaga foreign key.
  delete from public.activity_logs;
  delete from public.payments;
  delete from public.consultations;
  delete from public.clients;

  return jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'clients', v_clients,
      'consultations', v_consultations,
      'payments', v_payments,
      'activity_logs', v_activities
    )
  );
end;
$$;

revoke all on function public.reset_demo_data() from public;
grant execute on function public.reset_demo_data() to authenticated;

comment on function public.reset_demo_data() is
'Menghapus seluruh data operasional demo CRM. Hanya super_admin aktif. Tidak menghapus admin_profiles, services, auth user, schema, RLS, atau konfigurasi.';
