CERDAS FINANSIAL CRM - STAGE 3.5
REVENUE DASHBOARD & ANALYTICS

PERUBAHAN UTAMA
1. Revenue dashboard sekarang membaca pembayaran asli dan fallback dari consultations.
2. Data payment_status = paid pada consultations tetap dihitung meskipun tabel payments belum memiliki baris terkait.
3. Pencegahan hitung ganda berdasarkan consultation_id.
4. Statistik dashboard:
   - Total Client
   - Total Konsultasi
   - Paid
   - Pending
   - Revenue Bulan Ini
5. Revenue Analytics dengan filter:
   - Hari ini
   - 7 hari
   - 30 hari
   - Tahun ini
   - Semua
6. Grafik revenue 6 bulan terakhir.
7. Agenda hari ini dan agenda besok.
8. Aktivitas terbaru menampilkan sampai 5 aktivitas.

FILE YANG DIPERBARUI
- pages/dashboard.html
- js/dashboard.js
- js/api.js
- css/crm.css

CARA UPLOAD
1. Replace seluruh isi project lama dengan isi folder ini.
2. Jangan menghapus environment variables Supabase/Vercel.
3. Commit satu kali ke GitHub setelah rate limit Vercel selesai.
4. Buka dashboard dan tekan tombol refresh.

CATATAN
- Tidak diperlukan SQL baru untuk Stage 3.5.
- Revenue hanya menghitung status paid/lunas.
- Pembayaran pending, gagal, expired, refunded tidak masuk revenue.
