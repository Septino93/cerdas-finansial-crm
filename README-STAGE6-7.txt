CERDAS FINANSIAL CRM - STAGE 6 PREMIUM + STAGE 7 INTERNAL WORKSPACE

1. Replace seluruh isi project CRM dengan paket ini.
2. Jalankan STAGE7-DOCUMENT-STORAGE.sql satu kali di Supabase SQL Editor.
3. Deploy ulang ke Vercel.
4. Hard refresh browser.

PERUBAHAN STAGE 6
- Invoice dan Receipt didesain ulang total.
- Layout lebih padat, seimbang, profesional, dan tidak lagi memiliki ruang kosong berlebihan.
- Informasi client, planner, layanan, status, tanggal, dan total tersusun dua kolom.
- QR verifikasi dokumen.
- Receipt terpisah dari Invoice.

PERUBAHAN STAGE 7
- Client Snapshot.
- Tab Overview, Timeline, Dokumen, Catatan, Follow-up, dan Tagihan.
- Workflow checklist otomatis.
- Catatan internal admin.
- Follow-up dan status selesai.
- Upload dokumen ke Supabase Storage.
- Semua fitur hanya berada di CRM admin; client tidak dapat melihat halaman ini.

CATATAN KEAMANAN
Bucket dibuat public agar link file dapat dibuka langsung dari CRM. Untuk dokumen sangat sensitif seperti KTP/KK, tahap berikutnya disarankan memakai private bucket + signed URL. Jangan mengunggah dokumen sensitif sebelum kebijakan private storage diterapkan.
