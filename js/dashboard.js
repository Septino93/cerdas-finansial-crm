const DASHBOARD_TZ='Asia/Jakarta';

function localDateKey(value){
  if(!value)return'';
  return new Intl.DateTimeFormat('en-CA',{timeZone:DASHBOARD_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function todayKey(){return localDateKey(new Date())}
function monthKey(value){
  if(!value)return'';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:DASHBOARD_TZ,year:'numeric',month:'2-digit'}).formatToParts(new Date(value));
  return `${parts.find(x=>x.type==='year')?.value||''}-${parts.find(x=>x.type==='month')?.value||''}`;
}
function activityIcon(type=''){
  const value=String(type).toLowerCase();
  if(value.includes('payment'))return'wallet-cards';
  if(value.includes('consultation'))return'calendar-check';
  if(value.includes('client'))return'user-round';
  return'activity';
}
function relativeTime(value){
  if(!value)return'-';
  const diff=new Date(value).getTime()-Date.now();
  const abs=Math.abs(diff);
  const rtf=new Intl.RelativeTimeFormat('id-ID',{numeric:'auto'});
  if(abs<60_000)return'baru saja';
  if(abs<3_600_000)return rtf.format(Math.round(diff/60_000),'minute');
  if(abs<86_400_000)return rtf.format(Math.round(diff/3_600_000),'hour');
  if(abs<604_800_000)return rtf.format(Math.round(diff/86_400_000),'day');
  return fmtDate(value);
}
function timeOnly(value){
  if(!value)return'Belum dijadwalkan';
  return new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(value)).replace('.',':')+' WIB';
}
function renderAgenda(rows){
  const box=document.getElementById('todayAgenda');
  if(!rows.length){
    box.innerHTML='<div class="agenda-empty"><span><i data-lucide="calendar-check-2"></i></span><div><strong>Tidak ada agenda hari ini</strong><small>Jadwal yang dikonfirmasi akan tampil di sini.</small></div></div>';
    return;
  }
  box.innerHTML=rows.slice(0,4).map(x=>`<a class="agenda-item" href="client-detail.html?id=${encodeURIComponent(x.client_id)}"><time>${esc(timeOnly(x.scheduled_at))}</time><div><strong>${esc(x.clients?.full_name||'Client')}</strong><small>${esc(x.service_name_snapshot||'Konsultasi')}</small></div><span class="badge ${badgeClass(x.consultation_status)}">${statusLabel(x.consultation_status)}</span></a>`).join('');
}
function renderStatusSummary(consultations){
  const statuses=[
    ['waiting_payment','Menunggu Bayar','credit-card','orange'],
    ['waiting_schedule','Menunggu Jadwal','calendar-clock','blue'],
    ['confirmed','Dikonfirmasi','calendar-check-2','purple'],
    ['completed','Selesai','circle-check-big','green']
  ];
  document.getElementById('statusSummary').innerHTML=statuses.map(([status,label,icon,color])=>{
    const count=consultations.filter(x=>x.consultation_status===status).length;
    return `<a class="compact-status-card" href="bookings.html?status=${encodeURIComponent(status)}"><span class="metric-icon ${color}"><i data-lucide="${icon}"></i></span><span><strong>${count}</strong><small>${label}</small></span></a>`;
  }).join('');
}
function renderAttention(consultations,payments){
  const waitingSchedule=consultations.filter(x=>x.consultation_status==='waiting_schedule').length;
  const waitingPayment=Math.max(consultations.filter(x=>x.consultation_status==='waiting_payment').length,payments.filter(x=>x.status==='pending').length);
  const panel=document.getElementById('attentionPanel');
  if(!waitingSchedule&&!waitingPayment){panel.hidden=true;return}
  const parts=[];
  if(waitingPayment)parts.push(`${waitingPayment} pembayaran`);
  if(waitingSchedule)parts.push(`${waitingSchedule} penjadwalan`);
  document.getElementById('attentionText').textContent=parts.join(' dan ')+' perlu diperiksa.';
  panel.hidden=false;
}
function renderActivities(rows){
  document.getElementById('recentActivities').innerHTML=rows.slice(0,3).map(x=>`<a class="activity-row" href="${x.client_id?`client-detail.html?id=${encodeURIComponent(x.client_id)}`:'history.html'}"><span class="activity-icon"><i data-lucide="${activityIcon(x.event_type)}"></i></span><span class="activity-copy"><strong>${esc(x.clients?.full_name||'Aktivitas sistem')}</strong><small>${esc(x.description||statusLabel(x.event_type))}</small></span><time>${esc(relativeTime(x.created_at))}</time></a>`).join('')||'<div class="empty"><strong>Belum ada aktivitas</strong>Riwayat perubahan akan muncul di sini.</div>';
}

async function initDashboard(){
  if(!(await protectPage()))return;
  const refreshButton=document.getElementById('refreshDashboard');
  refreshButton?.classList.add('is-loading');
  refreshButton?.setAttribute('disabled','disabled');
  try{
    const d=await api.dashboard();
    const adminName=d.profile?.full_name||'Septino';
    const now=new Date();
    const today=todayKey();
    const currentMonth=monthKey(now);
    const todayConsultations=d.consultations
      .filter(x=>x.scheduled_at&&localDateKey(x.scheduled_at)===today&&x.consultation_status!=='cancelled')
      .sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
    const monthlyRevenue=d.payments
      .filter(x=>x.status==='paid'&&monthKey(x.paid_at||x.updated_at||x.created_at)===currentMonth)
      .reduce((sum,x)=>sum+Number(x.amount||0),0);

    document.getElementById('adminName').textContent=adminName.split(' ')[0];
    document.getElementById('adminInitial').textContent=adminName.charAt(0).toUpperCase();
    document.getElementById('dashboardDate').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,weekday:'long',day:'numeric',month:'long'}).format(now).toUpperCase();
    document.getElementById('statClients').textContent=d.clientCount;
    document.getElementById('statToday').textContent=todayConsultations.length;
    document.getElementById('statPayments').textContent=d.payments.filter(x=>x.status==='pending').length;
    document.getElementById('statRevenue').textContent=rupiah(monthlyRevenue);
    document.getElementById('lastUpdated').textContent=`Diperbarui ${new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,hour:'2-digit',minute:'2-digit'}).format(now)} WIB`;

    renderAttention(d.consultations,d.payments);
    renderAgenda(todayConsultations);
    renderStatusSummary(d.consultations);
    renderActivities(d.recentActivities||[]);
    if(window.lucide)lucide.createIcons();
  }catch(err){
    console.error(err);
    alert('Gagal memuat dashboard: '+err.message);
  }finally{
    refreshButton?.classList.remove('is-loading');
    refreshButton?.removeAttribute('disabled');
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('refreshDashboard')?.addEventListener('click',initDashboard);
  initDashboard();
});
