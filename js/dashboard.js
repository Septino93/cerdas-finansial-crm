async function initDashboard(){
 if(!(await protectPage()))return;
 try{
  const d=await api.dashboard();
  document.getElementById('adminName').textContent=d.profile?.full_name||'Septino';
  document.getElementById('statClients').textContent=d.clientCount;
  document.getElementById('statBookings').textContent=d.consultations.filter(x=>['waiting_payment','waiting_schedule'].includes(x.consultation_status)).length;
  document.getElementById('statPayments').textContent=d.payments.filter(x=>x.status==='pending').length;
  document.getElementById('statRevenue').textContent=rupiah(d.payments.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount||0),0));
  document.getElementById('recentBookings').innerHTML=d.recentConsultations.map(x=>`<a class="item" href="client-detail.html?id=${encodeURIComponent(x.client_id)}"><div class="avatar">${esc((x.clients?.full_name||'C')[0])}</div><div class="copy"><strong>${esc(x.clients?.full_name||'Client')}</strong><small>${esc(x.service_name_snapshot)} · ${fmtDate(x.created_at)}</small></div><span class="badge ${badgeClass(x.consultation_status)}">${statusLabel(x.consultation_status)}</span></a>`).join('')||'<div class="empty"><strong>Belum ada konsultasi</strong>Data dari Website Personal akan muncul di sini.</div>';
  document.getElementById('recentClients').innerHTML=d.recentClients.map(c=>`<a class="item" href="client-detail.html?id=${encodeURIComponent(c.id)}"><div class="avatar">${esc((c.full_name||'C')[0])}</div><div class="copy"><strong>${esc(c.full_name)}</strong><small>${esc(c.whatsapp||c.email||'Kontak belum diisi')}</small></div><span class="badge blue">${Number(c.consultation_credit||0)} credit</span></a>`).join('')||'<div class="empty"><strong>Belum ada client</strong>Tambahkan client atau tunggu pendaftaran masuk.</div>';
  if(window.lucide)lucide.createIcons();
 }catch(err){alert('Gagal memuat dashboard: '+err.message)}
}
document.addEventListener('DOMContentLoaded',initDashboard);
