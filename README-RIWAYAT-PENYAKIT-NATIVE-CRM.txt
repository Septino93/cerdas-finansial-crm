INTEGRASI RIWAYAT PENYAKIT — NATIVE CRM (TANPA LOGIN KEDUA)
================================================================

HASIL:
- Login hanya melalui CRM.
- Klik kartu “Riwayat Penyakit — Buka Modul”.
- Data kuisioner langsung tampil di dalam CRM.
- Username/password admin kuisioner tidak disimpan di browser.
- Form publik di form.septino.id tidak berubah.

LANGKAH DEPLOY:
1. Upload/replace seluruh isi folder Cerdas-Finansial-CRM ke repository CRM.
2. Di Vercel buka Project CRM > Settings > Environment Variables.
3. Tambahkan 5 variabel berikut untuk Production, Preview, dan Development:

   SUPABASE_URL
   Isi: URL Supabase yang dipakai CRM.

   SUPABASE_ANON_KEY
   Isi: Publishable/Anon Key Supabase yang dipakai CRM.

   APPS_SCRIPT_URL
   Isi: URL Web App Google Apps Script kuisioner yang berakhiran /exec.

   MEDICAL_ADMIN_USERNAME
   Isi: username admin kuisioner aktif.

   MEDICAL_ADMIN_PASSWORD
   Isi: password admin kuisioner aktif.

4. Setelah semua variabel ditambahkan, lakukan Redeploy di Vercel.
5. Login ke crm.septino.id lalu klik “Riwayat Penyakit — Buka Modul”.

PENTING:
- Jangan menaruh username/password admin kuisioner di file JavaScript frontend.
- Environment Variables hanya tersedia di serverless function /api/medical-history.js.
- Bila muncul pesan Environment Variables belum lengkap, cek ejaan kelima nama variabel di atas lalu Redeploy.
