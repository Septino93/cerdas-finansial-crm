CERDAS FINANSIAL CRM V3 — SUPABASE EDITION

Koneksi database sudah diatur ke project:
https://jjfnuqwjucqirmrgfjne.supabase.co

LANGKAH WAJIB SEBELUM LOGIN

1. Buka Supabase > Authentication > Users.
2. Klik Add user > Create new user.
3. Buat akun admin, contoh:
   Email    : admin@cerdasfinansial.id
   Password : buat password kuat milik Anda
4. Buka Supabase > SQL Editor.
5. Jalankan file SETUP-SUPABASE-ADMIN.sql.
6. Buka index.html atau login.html melalui local server/hosting.
7. Login memakai akun Supabase yang baru dibuat.

FITUR YANG SUDAH TERHUBUNG
- Supabase Auth untuk login admin
- Dashboard
- Client
- Konsultasi
- Pembayaran
- Aktivitas
- Detail client dan consultation credit
- Profil admin

CATATAN
- Jangan membuka file memakai file:// secara langsung. Gunakan Live Server atau deploy ke Vercel.
- Midtrans belum aktif. Tombol Tandai Lunas masih untuk pengujian admin.
- Website Personal belum dihubungkan pada ZIP ini.
- Publishable key aman berada di browser karena akses tabel dilindungi RLS.


VERSI INI
- Database utama sepenuhnya Supabase
- Tidak menggunakan localStorage untuk data CRM
- Role super_admin tetap dipertahankan saat profil diperbarui
