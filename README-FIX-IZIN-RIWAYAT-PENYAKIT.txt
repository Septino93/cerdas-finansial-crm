FIX IZIN RIWAYAT PENYAKIT — CRM
================================

Masalah yang diperbaiki:
"Anda tidak memiliki izin untuk memanggil UrlFetchApp.fetch"

KENAPA URLFETCHAPP TETAP DIGUNAKAN?
----------------------------------
CRM mengirim access token Supabase ke Google Apps Script. Backend perlu
memverifikasi bahwa token tersebut benar-benar milik admin CRM yang aktif.
Verifikasi aman ini dilakukan dari sisi server melalui Supabase, sehingga
membutuhkan izin script.external_request.

Menghapus UrlFetchApp berarti backend tidak lagi dapat memastikan bahwa
permintaan benar-benar berasal dari admin CRM. Karena itu versi ini memperbaiki
izin, bukan menghapus pemeriksaan keamanan.

LANGKAH PEMASANGAN
------------------
1. Buka project Google Apps Script Kuisioner Riwayat Penyakit.
2. Replace isi Code.gs dengan file BACKEND-APPS-SCRIPT/Code.gs.
3. Buka Project Settings, aktifkan "Show appsscript.json manifest file in editor".
4. Replace isi appsscript.json dengan BACKEND-APPS-SCRIPT/appsscript.json.
5. Dari dropdown fungsi di atas editor, pilih authorizeCrmIntegration.
6. Klik Run dan izinkan semua permission Google yang diminta.
7. Klik Deploy > Manage deployments > Edit.
8. Pilih New version lalu Deploy.
9. Pastikan js/config.js di CRM berisi URL Web App Apps Script yang aktif.
10. Upload folder CRM ini ke GitHub/Vercel dan redeploy CRM.

HASIL
-----
- Login hanya sekali di CRM.
- Tidak ada login admin kuisioner kedua.
- Dashboard menampilkan jumlah form masuk.
- Modul Riwayat Penyakit dapat membaca dan mengelola data.
- Token CRM tetap diverifikasi secara aman di backend.
