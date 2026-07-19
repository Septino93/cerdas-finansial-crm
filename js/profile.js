function setButtonLoading(button, loading, loadingText) {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${loadingText}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    if (window.lucide) lucide.createIcons();
  }
}

function friendlyAuthError(error) {
  const message = String(error?.message || error || 'Terjadi kesalahan.');
  if (/already registered|already been registered|already exists/i.test(message)) return 'Email tersebut sudah digunakan oleh akun lain.';
  if (/invalid email/i.test(message)) return 'Format email tidak valid.';
  if (/password.*(least|characters)|weak password/i.test(message)) return 'Password minimal 8 karakter.';
  if (/same password/i.test(message)) return 'Password baru harus berbeda dari password sebelumnya.';
  if (/reauthentication|security purposes/i.test(message)) return 'Sesi keamanan sudah terlalu lama. Silakan logout, login kembali, lalu coba lagi.';
  return message;
}

async function initProfile() {
  if (!(await protectPage())) return;

  const profileForm = document.getElementById('profileForm');
  const emailForm = document.getElementById('emailForm');
  const passwordForm = document.getElementById('passwordForm');
  const profileName = document.getElementById('profileName');
  const currentEmail = document.getElementById('currentEmail');
  const newEmail = document.getElementById('newEmail');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  try {
    const { data: { user }, error: userError } = await cfSupabase.auth.getUser();
    if (userError) throw userError;
    const profile = await api.adminProfile();
    profileName.value = profile?.full_name || '';
    currentEmail.value = user?.email || '';
  } catch (error) {
    alert('Gagal memuat profil: ' + friendlyAuthError(error));
    return;
  }

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('saveProfileBtn');
    const name = profileName.value.trim();
    if (!name) return alert('Nama profesional wajib diisi.');
    setButtonLoading(button, true, 'Menyimpan...');
    try {
      await api.saveProfile({ name });
      alert('Profil berhasil disimpan.');
    } catch (error) {
      alert('Gagal menyimpan profil: ' + friendlyAuthError(error));
    } finally {
      setButtonLoading(button, false);
    }
  });

  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('updateEmailBtn');
    const email = newEmail.value.trim().toLowerCase();
    if (!email) return alert('Masukkan email baru.');
    if (email === currentEmail.value.trim().toLowerCase()) return alert('Email baru sama dengan email saat ini.');
    if (!confirm(`Ubah email login menjadi ${email}?`)) return;

    setButtonLoading(button, true, 'Memproses...');
    try {
      const { data, error } = await cfSupabase.auth.updateUser({ email });
      if (error) throw error;
      newEmail.value = '';
      const effectiveEmail = data?.user?.email || email;
      currentEmail.value = effectiveEmail;
      alert('Permintaan perubahan email berhasil. Periksa inbox email lama dan email baru bila Supabase meminta konfirmasi.');
    } catch (error) {
      alert('Gagal mengubah email: ' + friendlyAuthError(error));
    } finally {
      setButtonLoading(button, false);
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('updatePasswordBtn');
    const password = newPassword.value;
    const confirmation = confirmPassword.value;
    if (password.length < 8) return alert('Password minimal 8 karakter.');
    if (password !== confirmation) return alert('Konfirmasi password tidak sama.');
    if (!confirm('Ganti password login sekarang?')) return;

    setButtonLoading(button, true, 'Mengubah...');
    try {
      const { error } = await cfSupabase.auth.updateUser({ password });
      if (error) throw error;
      passwordForm.reset();
      alert('Password berhasil diubah. Gunakan password baru pada login berikutnya.');
    } catch (error) {
      alert('Gagal mengubah password: ' + friendlyAuthError(error));
    } finally {
      setButtonLoading(button, false);
    }
  });

  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
      button.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      if (window.lucide) lucide.createIcons();
    });
  });
}

document.addEventListener('DOMContentLoaded', initProfile);
