CERDAS FINANSIAL CRM - STAGE 6
INVOICE & RECEIPT PDF

Fitur:
1. Download Invoice PDF dari halaman Pembayaran.
2. Download Receipt PDF khusus transaksi berstatus Lunas.
3. Download dokumen yang sama dari halaman Detail Client.
4. Nomor dokumen otomatis mengikuti nomor konsultasi/invoice.
5. Nama client, layanan, nominal, status, dan tanggal terisi otomatis.
6. Format PDF A4 portrait dengan branding Cerdas Finansial.
7. Tidak membutuhkan SQL tambahan.
8. Tidak menggunakan layanan berbayar atau penyimpanan PDF eksternal.

CATATAN:
- Invoice tersedia untuk transaksi pending maupun paid.
- Receipt hanya tersedia jika status pembayaran = paid.
- PDF dibuat langsung di browser menggunakan jsPDF dan langsung diunduh.
- Karena memakai CDN jsPDF, perangkat memerlukan koneksi internet saat pertama memuat halaman.

FILE BARU:
- js/invoice-receipt.js

FILE DIPERBARUI:
- pages/payments.html
- pages/client-detail.html
- js/payments.js
- js/client-detail.js
