// Vercel Serverless Function
// Menyatukan autentikasi CRM (Supabase) dengan backend Kuisioner (Google Apps Script).

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    const {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      APPS_SCRIPT_URL,
      MEDICAL_ADMIN_USERNAME,
      MEDICAL_ADMIN_PASSWORD
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !APPS_SCRIPT_URL ||
        !MEDICAL_ADMIN_USERNAME || !MEDICAL_ADMIN_PASSWORD) {
      throw new Error('Environment Variables modul Riwayat Penyakit belum lengkap di Vercel.');
    }

    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Sesi CRM tidak ditemukan.' });
    }

    // Verifikasi bahwa token benar-benar merupakan sesi Supabase yang aktif.
    const userResponse = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorization
      }
    });

    if (!userResponse.ok) {
      return res.status(401).json({ success: false, message: 'Sesi CRM sudah berakhir. Silakan login kembali.' });
    }

    const user = await userResponse.json();
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'Akun CRM tidak valid.' });
    }

    const requestBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(requestBody.action || '');
    const allowedActions = ['listData', 'getDetail', 'updateStatus', 'exportPdf', 'deleteData'];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Action modul tidak diizinkan.' });
    }

    // Login ke backend Kuisioner hanya dilakukan di server. Username/password tidak pernah dikirim ke browser.
    const loginData = await gasCall(APPS_SCRIPT_URL, {
      action: 'login',
      username: MEDICAL_ADMIN_USERNAME,
      password: MEDICAL_ADMIN_PASSWORD
    });

    if (!loginData.success || !loginData.session) {
      throw new Error(loginData.message || 'Gagal menghubungkan backend kuisioner.');
    }

    const result = await gasCall(APPS_SCRIPT_URL, {
      ...requestBody,
      action,
      session: loginData.session
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('medical-history proxy error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan server.' });
  }
};

async function gasCall(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error('Respons Google Apps Script tidak valid. Pastikan URL /exec dan deployment aktif.');
  }
}
