INTEGRASI MODUL RIWAYAT PENYAKIT KE CRM
========================================

FILE BARU:
- pages/medical-history.html
- js/medical-history.js
- js/medical-history-config.js
- css/medical-history.css

FILE YANG DIUBAH:
- pages/dashboard.html (ditambah kartu menu Riwayat Penyakit)

LANGKAH WAJIB SEBELUM UPLOAD:
1. Buka js/medical-history-config.js
2. Ganti PASTE_APPS_SCRIPT_WEB_APP_URL_HERE dengan URL Web App Apps Script aktif
   yang berakhiran /exec.
3. Upload/replace seluruh folder Cerdas-Finansial-CRM ke GitHub/Vercel seperti biasa.
4. Login CRM, lalu klik kartu RIWAYAT PENYAKIT di dashboard.
5. Pertama kali saja, masukkan username dan password admin kuisioner.
   Sesi tersimpan di perangkat/browser tersebut. Login CRM tetap menjadi pintu utama.

HASIL:
- Form publik tetap di https://form.septino.id
- Admin kuisioner tersedia di CRM pada pages/medical-history.html
- Fitur: pencarian, filter status, statistik, detail, dokumen, folder Drive,
  WhatsApp, download PDF, perubahan status, dan hapus data.

CATATAN KEAMANAN:
- Username/password kuisioner tidak ditulis di source code.
- Hanya token sesi sementara yang disimpan di localStorage browser.
- Bila perangkat berganti atau sesi berakhir, modul meminta verifikasi ulang.
