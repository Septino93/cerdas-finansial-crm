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
  const rows=consultations||[];
  const statuses=[
    {
      label:'Menunggu Pembayaran',icon:'credit-card',color:'orange',
      count:rows.filter(x=>Number(x.amount||0)>0&&x.payment_status==='pending'&&!x.payment_proof_url).length
    },
    {
      label:'Menunggu Verifikasi',icon:'scan-search',color:'orange',
      count:rows.filter(x=>x.payment_status==='verification'||(Number(x.amount||0)>0&&x.payment_status==='pending'&&x.payment_proof_url)).length
    },
    {
      label:'Menunggu Jadwal',icon:'calendar-clock',color:'blue',
      count:rows.filter(x=>x.consultation_status==='waiting_schedule').length
    },
    {
      label:'Dikonfirmasi',icon:'calendar-check-2',color:'purple',
      count:rows.filter(x=>x.consultation_status==='confirmed').length
    },
    {
      label:'Selesai',icon:'circle-check-big',color:'green',
      count:rows.filter(x=>x.consultation_status==='completed').length
    }
  ];
  const box=document.getElementById('statusSummary');
  if(!box)return;
  box.innerHTML=statuses.map(item=>`<a class="compact-status-card" href="bookings.html"><span class="metric-icon ${item.color}"><i data-lucide="${item.icon}"></i></span><span><strong>${item.count}</strong><small>${item.label}</small></span></a>`).join('');
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
    document.getElementById('statRevenue').textContent=rupiah(monthlyRevenue).replace('Rp','Rp ');
    document.getElementById('lastUpdated').textContent=`Diperbarui ${new Intl.DateTimeFormat('id-ID',{timeZone:DASHBOARD_TZ,hour:'2-digit',minute:'2-digit'}).format(now)} WIB`;

    renderStatusSummary(d.consultations);
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
  document.getElementById('exportDashboardReport')?.addEventListener('click',exportStage8Report);
  initDashboard();
});

function stage8Followups(activities){
  return (activities||[]).filter(a=>a.event_type==='follow_up_created'&&!a.metadata?.completed_at&&a.metadata?.follow_up_date).sort((a,b)=>String(a.metadata.follow_up_date).localeCompare(String(b.metadata.follow_up_date)));
}
function daysFromToday(dateValue){
  if(!dateValue)return 0;
  const a=new Date(todayKey()+'T00:00:00');
  const b=new Date(String(dateValue).slice(0,10)+'T00:00:00');
  return Math.round((b-a)/86400000);
}
function renderStage8ControlCenter(d){
  const consultations=d.consultations||[];
  const paid=uniquePaidPayments(d.payments||[]);
  const billable=consultations.filter(c=>Number(c.amount||0)>0);
  const paidIds=new Set(paid.map(p=>p.consultation_id).filter(Boolean));
  const paidBillable=billable.filter(c=>c.payment_status==='paid'||paidIds.has(c.id));
  const conversion=billable.length?Math.round(paidBillable.length/billable.length*100):0;
  const avg=paid.length?paid.reduce((sum,p)=>sum+Number(p.amount||0),0)/paid.length:0;
  const followups=stage8Followups(d.activities||[]);
  const overdue=followups.filter(f=>daysFromToday(f.metadata.follow_up_date)<0);

  document.getElementById('kpiConversion').textContent=conversion+'%';
  document.getElementById('kpiConversionNote').textContent=`${paidBillable.length} dari ${billable.length} konsultasi berbayar`;
  document.getElementById('kpiAverageOrder').textContent=rupiah(avg);
  document.getElementById('kpiOverdueFollowup').textContent=overdue.length;
  document.getElementById('kpiFollowupNote').textContent=overdue.length?`${overdue.length} perlu segera ditindaklanjuti`:'Tidak ada follow-up terlambat';

  const serviceMap=new Map();
  consultations.forEach(c=>{
    const name=c.service_name_snapshot||'Layanan lainnya';
    const row=serviceMap.get(name)||{name,count:0,revenue:0};
    row.count++;
    if(c.payment_status==='paid'||paidIds.has(c.id))row.revenue+=Number(c.amount||0);
    serviceMap.set(name,row);
  });
  const services=[...serviceMap.values()].sort((a,b)=>b.count-a.count||b.revenue-a.revenue).slice(0,6);
  const maxCount=Math.max(...services.map(x=>x.count),1);
  document.getElementById('servicePerformance').innerHTML=services.length?services.map(x=>`<div class="service-performance-row"><div><strong>${esc(x.name)}</strong><small>${x.count} konsultasi</small></div><span>${rupiah(x.revenue)}</span><div class="service-progress"><i style="width:${Math.max(8,x.count/maxCount*100)}%"></i></div></div>`).join(''):'<div class="control-empty">Belum ada data layanan.</div>';

  document.getElementById('followupControlList').innerHTML=followups.length?followups.slice(0,5).map(f=>{
    const diff=daysFromToday(f.metadata.follow_up_date);
    const label=diff<0?`${Math.abs(diff)} hari terlambat`:diff===0?'Hari ini':diff===1?'Besok':`${diff} hari lagi`;
    return `<a class="followup-control-item" href="client-detail.html?id=${encodeURIComponent(f.client_id)}&tab=followup"><span><i data-lucide="bell-ring"></i></span><div><strong>${esc(f.clients?.full_name||'Client')}</strong><small>${esc(f.metadata?.title||f.description||'Follow-up')}</small></div><time>${esc(label)}</time></a>`;
  }).join(''):'<div class="control-empty">Belum ada follow-up aktif.</div>';

}
function csvCell(value){return '"'+String(value??'').replace(/"/g,'""')+'"'}
function exportStage8Report(){
  if(!dashboardCache)return;
  const d=dashboardCache;
  const paid=uniquePaidPayments(d.payments||[]);
  const rows=[
    ['Laporan CRM Control Center','Cerdas Finansial'],
    ['Tanggal Export',new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short'}).format(new Date())],
    [],
    ['Metrik','Nilai'],
    ['Total Client',d.clientCount||0],
    ['Total Konsultasi',(d.consultations||[]).length],
    ['Pembayaran Lunas',paid.length],
    ['Pembayaran Pending',(d.payments||[]).filter(p=>p.status==='pending').length],
    ['Total Revenue',paid.reduce((s,p)=>s+Number(p.amount||0),0)],
    ['Follow-up Aktif',stage8Followups(d.activities||[]).length],
    [],
    ['Layanan','Jumlah Konsultasi','Revenue Lunas']
  ];
  const paidIds=new Set(paid.map(p=>p.consultation_id).filter(Boolean));
  const map=new Map();
  (d.consultations||[]).forEach(c=>{const name=c.service_name_snapshot||'Lainnya';const r=map.get(name)||[name,0,0];r[1]++;if(c.payment_status==='paid'||paidIds.has(c.id))r[2]+=Number(c.amount||0);map.set(name,r)});
  rows.push(...[...map.values()].sort((a,b)=>b[1]-a[1]));
  const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`CRM-Control-Center-${todayKey()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
