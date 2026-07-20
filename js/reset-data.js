const RESET_PHRASE = 'HAPUS DATA DEMO';

function setResetLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Menghapus data...</span>';
  } else {
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    if (window.lucide) lucide.createIcons();
  }
}

async function deleteTrackedClientDocuments() {
  const { data, error } = await cfSupabase
    .from('activity_logs')
    .select('metadata')
    .eq('event_type', 'document_uploaded');

  if (error) throw error;

  const paths = (data || [])
    .map((row) => row?.metadata?.path)
    .filter((path) => typeof path === 'string' && path.trim());

  if (!paths.length) return 0;

  // Supabase Storage menerima penghapusan dalam batch. Batasi per 100 file.
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { error: removeError } = await cfSupabase.storage
      .from('client-documents')
      .remove(batch);
    if (removeError) throw removeError;
  }

  return paths.length;
}

async function initResetDemo() {
  if (!(await protectPage())) return;

  const form = document.getElementById('resetDemoForm');
  const phraseInput = document.getElementById('confirmPhrase');
  const checkbox = document.getElementById('confirmUnderstand');
  const button = document.getElementById('resetDemoBtn');
  const result = document.getElementById('resetResult');

  const { data: { user }, error: userError } = await cfSupabase.auth.getUser();
  if (userError || !user) {
    alert('Sesi login tidak ditemukan.');
    location.replace('../login.html');
    return;
  }

  const { data: profile, error: profileError } = await cfSupabase
    .from('admin_profiles')
    .select('role,is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false || profile.role !== 'super_admin') {
    alert('Menu ini hanya dapat digunakan oleh Super Admin aktif.');
    location.replace('profile.html');
    return;
  }

  const updateButtonState = () => {
    button.disabled = !(
      phraseInput.value.trim() === RESET_PHRASE &&
      checkbox.checked
    );
  };

  phraseInput.addEventListener('input', updateButtonState);
  checkbox.addEventListener('change', updateButtonState);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (phraseInput.value.trim() !== RESET_PHRASE || !checkbox.checked) return;

    const finalConfirmation = window.confirm(
      'KONFIRMASI TERAKHIR\n\nSemua data client, konsultasi, pembayaran, aktivitas, dan dokumen client akan dihapus permanen.\n\nLanjutkan reset?'
    );
    if (!finalConfirmation) return;

    setResetLoading(button, true);
    phraseInput.disabled = true;
    checkbox.disabled = true;
    result.className = 'reset-result';
    result.textContent = 'Menghapus dokumen dan data operasional...';

    try {
      const deletedDocuments = await deleteTrackedClientDocuments();
      const { data, error } = await cfSupabase.rpc('reset_demo_data');
      if (error) throw error;

      const deleted = data?.deleted || {};
      result.className = 'reset-result success';
      result.textContent = `Reset berhasil: ${deleted.clients || 0} client, ${deleted.consultations || 0} konsultasi, ${deleted.payments || 0} pembayaran, ${deleted.activity_logs || 0} aktivitas, dan ${deletedDocuments} dokumen dihapus.`;

      phraseInput.value = '';
      checkbox.checked = false;
      setTimeout(() => location.replace('dashboard.html'), 1800);
    } catch (error) {
      console.error(error);
      result.className = 'reset-result error';
      result.textContent = `Reset gagal: ${error?.message || error}. Pastikan RESET-DATA-DEMO.sql sudah dijalankan di Supabase.`;
      phraseInput.disabled = false;
      checkbox.disabled = false;
      setResetLoading(button, false);
      updateButtonState();
    }
  });

  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', initResetDemo);
