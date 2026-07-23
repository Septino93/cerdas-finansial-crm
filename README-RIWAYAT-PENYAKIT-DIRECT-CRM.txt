INTEGRASI RIWAYAT PENYAKIT LANGSUNG KE CRM
================================================

HASIL:
- Admin cukup login satu kali di crm.septino.id.
- Tidak ada login admin kuisioner kedua.
- Dashboard menampilkan ikon Riwayat Penyakit dan jumlah formulir masuk.
- Modul Riwayat Penyakit membaca Google Sheets/Drive melalui backend Apps Script yang sama.
- Tidak memakai Environment Variables APPS_SCRIPT_URL di Vercel.

LANGKAH 1 — ISI URL APPS SCRIPT DI CRM
Buka: js/config.js
Ganti:
  PASTE_GOOGLE_APPS_SCRIPT_EXEC_URL_HERE
Dengan Web App URL Google Apps Script kuisioner yang berakhiran /exec.

LANGKAH 2 — GANTI BACKEND APPS SCRIPT
Gunakan file:
  BACKEND-APPS-SCRIPT/Code.gs
Untuk mengganti isi Code.gs pada project Kuisioner Riwayat Penyakit.

Kemudian:
Deploy > Manage deployments > Edit > New version > Deploy
Pastikan:
- Execute as: Me
- Who has access: Anyone

LANGKAH 3 — UPLOAD CRM
Upload seluruh isi folder CRM ke repository CRM, lalu redeploy Vercel.

CATATAN:
- Form publik form.septino.id tetap bekerja seperti biasa.
- File admin.html/admin.js lama boleh dihapus setelah modul CRM sudah dites berhasil.
- Tidak perlu menambah APPS_SCRIPT_URL, username, atau password pada Vercel Environment Variables.
