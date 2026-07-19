const DASHBOARD_TZ='Asia/Jakarta';
let dashboardCache=null;

function localDateKey(value){
  if(!value)return'';
  return new Intl.DateTimeFormat('en-CA',{timeZone:DASHBOARD_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function todayKey(){return localDateKey(new Date())}
function addDaysKey(days){const d=new Date();d.setDate(d.getDate()+days);return localDateKey(d)}
function monthKey(value){
  if(!value)return'';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:DASHBOARD_TZ,year:'numeric',month:'2-digit'}).formatToParts(new Date(value));
  return `${parts.find(x=>x.type==='year')?.value||''}-${parts.find(x=>x.type==='month')?.value||''}`;
}
function activityIcon(type=''){
  const value=String(type).toLowerCase();
  if(value.includes('payment'))return'wallet-cards';
  if(value.includes('scheduled'))return'calendar-clock';
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
function paymentDate(row){return row.paid_at||row.updated_at||row.created_at}
function isPaid(row){return row.status==='paid'}
function uniquePaidPayments(rows){
  const byConsultation=new Map();
  const unlinked=[];
  (rows||[]).filter(isPaid).forEach(row=>{
    if(row.consultation_id){
      const current=byConsultation.get(row.consultation_id);
      if(!current||new Date(paymentDate(row))>new Date(paymentDate(current)))byConsultation.set(row.consultation_id,row);
    }else unlinked.push(row);
  });
  return [...byConsultation.values(),...unlinked];
}
function filterPayments(rows,range){
  const now=new Date();
  const start=new Date(now);
  if(range==='today')return rows.filter(x=>localDateKey(paymentDate(x))===todayKey());
  if(range==='7d'){start.setDate(start.getDate()-6);start.setHours(0,0,0,0);return rows.filter(x=>new Date(paymentDate(x))>=start)}
  if(range==='30d'){start.setDate(start.getDate()-29);start.setHours(0,0,0,0);return rows.filter(x=>new Date(paymentDate(x))>=start)}
  if(range==='year'){const year=new Intl.DateTimeFormat('en',{timeZone:DASHBOARD_TZ,year:'numeric'}).format(now);return rows.filter(x=>monthKey(paymentDate(x)).startsWith(year+'-'))}
  return rows;
}
function renderAgenda(rows,targetId,emptyTitle,emptyText){
  const box=document.getElementById(targetId);
  if(!rows.length){
    box.innerHTML=`<div class="agenda-empty"><span><i data-lucide="calendar-check-2"></i></span><div><strong>${esc(emptyTitle)}</strong><small>${esc(emptyText)}</small></div></div>`;
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
  const reminderTomorrow=consultations.filter(x=>x.consultation_status==='confirmed'&&x.scheduled_at&&localDateKey(x.scheduled_at)===addDaysKey(1)).length;
  const panel=document.getElementById('attentionPanel');
  if(!waitingSchedule&&!waitingPayment&&!reminderTomorrow){panel.hidden=true;return}
  const parts=[];
  if(waitingPayment)parts.push(`${waitingPayment} pembayaran`);
  if(waitingSchedule)parts.push(`${waitingSchedule} penjadwalan`);
  if(reminderTomorrow)parts.push(`${reminderTomorrow} reminder H-1`);
  document.getElementById('attentionText').textContent=parts.join(' dan ')+' perlu diperiksa.';
  panel.hidden=false;
}
function renderActivities(rows){
  document.getElementById('recentActivities').innerHTML=rows.slice(0,5).map(x=>`<a class="activity-row" href="${x.client_id?`client-detail.html?id=${encodeURIComponent(x.client_id)}`:'history.html'}"><span class="activity-icon"><i data-lucide="${activityIcon(x.event_type)}"></i></span><span class="activity-copy"><strong>${esc(x.clients?.full_name||'Aktivitas sistem')}</strong><small>${esc(x.description||statusLabel(x.event_type))}</small></span><time>${esc(relativeTime(x.created_at))}</time></a>`).join('')||'<div class="empty"><strong>Belum ada aktivitas</strong>Riwayat perubahan akan muncul di sini.</div>';
}
function renderRevenueChart(payments){
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=monthKey(d);
    const label=new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,month:'short'}).format(d).replace('.','');
    const total=payments.filter(x=>monthKey(paymentDate(x))===key).reduce((sum,x)=>sum+Number(x.amount||0),0);
    months.push({key,label,total});
  }
  const max=Math.max(...months.map(x=>x.total),1);
  document.getElementById('revenueChart').innerHTML=months.map(x=>`<div class="chart-column"><span class="chart-value">${x.total?compactRupiah(x.total):'-'}</span><div class="chart-track"><span class="chart-bar" style="height:${Math.max(x.total/max*100,x.total?8:0)}%"></span></div><small>${esc(x.label)}</small></div>`).join('');
}
function compactRupiah(value){
  const n=Number(value||0);
  if(n>=1_000_000_000)return'Rp'+(n/1_000_000_000).toFixed(n%1_000_000_000?1:0)+'M';
  if(n>=1_000_000)return'Rp'+(n/1_000_000).toFixed(n%1_000_000?1:0)+'jt';
  if(n>=1_000)return'Rp'+Math.round(n/1_000)+'rb';
  return'Rp'+n;
}
function updateRevenueRange(){
  if(!dashboardCache)return;
  const range=document.getElementById('revenueRange')?.value||'30d';
  const paid=uniquePaidPayments(dashboardCache.payments);
  const filtered=filterPayments(paid,range);
  const total=filtered.reduce((sum,x)=>sum+Number(x.amount||0),0);
  document.getElementById('analyticsRevenue').textContent=rupiah(total);
  document.getElementById('analyticsTransactions').textContent=`${filtered.length} transaksi lunas`;
}

async function initDashboard(){
  if(!(await protectPage()))return;
  const refreshButton=document.getElementById('refreshDashboard');
  refreshButton?.classList.add('is-loading');
  refreshButton?.setAttribute('disabled','disabled');
  try{
    const d=await api.dashboard();
    dashboardCache=d;
    const adminName=d.profile?.full_name||'Septino';
    const now=new Date();
    const today=todayKey();
    const tomorrow=addDaysKey(1);
    const currentMonth=monthKey(now);
    const activeConsultations=d.consultations.filter(x=>x.consultation_status!=='cancelled');
    const todayConsultations=activeConsultations.filter(x=>x.scheduled_at&&localDateKey(x.scheduled_at)===today).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
    const tomorrowConsultations=activeConsultations.filter(x=>x.scheduled_at&&localDateKey(x.scheduled_at)===tomorrow).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
    const paidPayments=uniquePaidPayments(d.payments);
    const monthlyRevenue=paidPayments.filter(x=>monthKey(paymentDate(x))===currentMonth).reduce((sum,x)=>sum+Number(x.amount||0),0);
    const pendingCount=d.payments.filter(x=>x.status==='pending').length;

    document.getElementById('adminName').textContent=adminName.split(' ')[0];
    document.getElementById('adminInitial').textContent=adminName.charAt(0).toUpperCase();
    document.getElementById('dashboardDate').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,weekday:'long',day:'numeric',month:'long'}).format(now).toUpperCase();
    document.getElementById('statClients').textContent=d.clientCount;
    document.getElementById('statConsultations').textContent=d.consultations.length;
    document.getElementById('statPaid').textContent=paidPayments.length;
    document.getElementById('statPayments').textContent=pendingCount;
    document.getElementById('statRevenue').textContent=rupiah(monthlyRevenue);
    document.getElementById('lastUpdated').textContent=`Diperbarui ${new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,hour:'2-digit',minute:'2-digit'}).format(now)} WIB`;

    renderAttention(d.consultations,d.payments);
    renderAgenda(todayConsultations,'todayAgenda','Tidak ada agenda hari ini','Jadwal yang dikonfirmasi akan tampil di sini.');
    renderAgenda(tomorrowConsultations,'tomorrowAgenda','Tidak ada agenda besok','Belum ada konsultasi terjadwal untuk besok.');
    renderStatusSummary(d.consultations);
    renderActivities(d.recentActivities||[]);
    renderRevenueChart(paidPayments);
    updateRevenueRange();
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
  document.getElementById('revenueRange')?.addEventListener('change',updateRevenueRange);
  initDashboard();
});
