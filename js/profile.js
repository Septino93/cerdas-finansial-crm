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
  const websitePhotoForm = document.getElementById('websitePhotoForm');
  const websitePhotoInput = document.getElementById('websitePhotoInput');
  const websitePhotoPreview = document.getElementById('websitePhotoPreview');
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

    const { data: photoSetting, error: photoError } = await cfSupabase
      .from('website_settings')
      .select('value')
      .eq('key', 'profile_photo_url')
      .maybeSingle();
    if (!photoError && photoSetting?.value) websitePhotoPreview.src = photoSetting.value;
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

  websitePhotoInput?.addEventListener('change', () => {
    const file = websitePhotoInput.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      websitePhotoInput.value = '';
      return alert('Gunakan file JPG, PNG, atau WebP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      websitePhotoInput.value = '';
      return alert('Ukuran foto maksimal 5 MB.');
    }
    websitePhotoPreview.src = URL.createObjectURL(file);
  });

  websitePhotoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('uploadWebsitePhotoBtn');
    const file = websitePhotoInput.files?.[0];
    if (!file) return alert('Pilih foto terlebih dahulu.');
    if (!confirm('Ubah foto utama di website septino.id sekarang?')) return;

    setButtonLoading(button, true, 'Mengunggah...');
    try {
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `profile/profile-${Date.now()}.${extension}`;
      const { error: uploadError } = await cfSupabase.storage
        .from('website-assets')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = cfSupabase.storage.from('website-assets').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('URL foto tidak berhasil dibuat.');

      const { error: settingError } = await cfSupabase
        .from('website_settings')
        .upsert({ key: 'profile_photo_url', value: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (settingError) {
        await cfSupabase.storage.from('website-assets').remove([path]);
        throw settingError;
      }

      websitePhotoPreview.src = `${publicUrl}?v=${Date.now()}`;
      websitePhotoInput.value = '';
      alert('Foto website berhasil diperbarui. Buka septino.id lalu refresh untuk melihat perubahan.');
    } catch (error) {
      alert('Gagal mengubah foto website: ' + friendlyAuthError(error));
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
      const { data, error } = await cfSupabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/pages/profile.html` }
      );
      if (error) throw error;
      newEmail.value = '';
      // Saat Secure Email Change aktif, email lama tetap berlaku sampai verifikasi selesai.
      currentEmail.value = data?.user?.email || currentEmail.value;
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
