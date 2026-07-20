FITUR RESET DATA DEMO

1. Upload/replace seluruh isi ZIP ke GitHub.
2. Buka Supabase > SQL Editor.
3. Jalankan file RESET-DATA-DEMO.sql satu kali.
4. Buka CRM > Profil & Akun > Reset Data Demo.
5. Ketik HAPUS DATA DEMO, centang persetujuan, lalu tekan Reset Semua Data Demo.

DATA YANG DIHAPUS:
- clients
- consultations
- payments
- activity_logs
- dokumen client yang tercatat di activity_logs

DATA YANG TETAP ADA:
- akun Supabase Authentication
- admin_profiles
- services
- konfigurasi, schema, RLS, domain, dan Midtrans

PENTING:
- Gunakan hanya sebelum data client asli dimasukkan.
- Tindakan ini permanen dan tidak bisa dibatalkan.
- Menu hanya dapat dijalankan oleh admin aktif dengan role super_admin.
