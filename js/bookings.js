let cachedClients=[],cachedServices=[],cachedConsultations=[],lastScheduled=null;

async function initBookings(){
 if(!(await protectPage()))return;
 bookingForm.addEventListener('submit',addConsultation);
 bookingFilter.addEventListener('change',renderConsultations);
 scheduleForm.addEventListener('submit',saveSchedule);
 sendScheduleWaBtn.addEventListener('click',sendScheduleWhatsApp);
 document.querySelectorAll('[data-close-schedule]').forEach(el=>el.addEventListener('click',closeScheduleModal));
 [cachedClients,cachedServices]=await Promise.all([api.listClients(),api.services()]);
 bookingClient.innerHTML='<option value="">Pilih client</option>'+cachedClients.map(c=>`<option value="${c.id}">${esc(c.full_name)}</option>`).join('');
 bookingService.innerHTML=cachedServices.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
 scheduleDate.min=new Date().toISOString().slice(0,10);
 await renderConsultations();
}

async function addConsultation(e){
 e.preventDefault();
 try{
  await api.createConsultation({
   clientId:bookingClient.value,
   serviceId:bookingService.value,
   method:bookingMethod.value,
   notes:bookingNotes.value.trim()
  });
  e.target.reset();
  await renderConsultations();
 }catch(err){alert('Gagal membuat konsultasi: '+err.message)}
}

async function setConsultation(id,status){
 try{
  await api.updateConsultation(id,{consultation_status:status});
  await renderConsultations();
 }catch(err){alert(err.message)}
}

function openScheduleModal(id){
 const x=cachedConsultations.find(v=>v.id===id);
 if(!x)return;
 scheduleId.value=x.id;
 schedulePhone.value=x.clients?.whatsapp||'';
 scheduleService.textContent=x.service_name_snapshot||'Konsultasi';
 scheduleClient.textContent=x.clients?.full_name||'Client';
 scheduleNumber.textContent=x.consultation_no||'-';
 scheduleDate.value=x.scheduled_at?new Date(x.scheduled_at).toISOString().slice(0,10):'';
 scheduleTime.value=x.scheduled_at?new Date(x.scheduled_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
 scheduleMethod.value=x.meeting_method||'Google Meet';
 scheduleLink.value=x.meeting_link||'';
 scheduleNotes.value=x.admin_notes||'';
 sendScheduleWaBtn.hidden=true;
 lastScheduled=null;
 scheduleModal.hidden=false;
 document.body.style.overflow='hidden';
 if(window.lucide)lucide.createIcons();
}

function closeScheduleModal(){
 scheduleModal.hidden=true;
 document.body.style.overflow='';
}

async function saveSchedule(e){
 e.preventDefault();
 saveScheduleBtn.disabled=true;
 saveScheduleBtn.textContent='Menyimpan...';
 try{
  const row=await api.scheduleConsultation(scheduleId.value,{
   date:scheduleDate.value,
   time:scheduleTime.value,
   method:scheduleMethod.value,
   link:scheduleLink.value.trim(),
   notes:scheduleNotes.value.trim()
  });
  lastScheduled=row;
  sendScheduleWaBtn.hidden=false;
  saveScheduleBtn.textContent='Jadwal Tersimpan';
  await renderConsultations();
  alert('Jadwal berhasil disimpan. Klik "Kirim Jadwal via WhatsApp" untuk menghubungi client.');
 }catch(err){
  alert('Gagal menyimpan jadwal: '+err.message);
  saveScheduleBtn.textContent='Simpan Jadwal';
 }finally{
  saveScheduleBtn.disabled=false;
 }
}

function sendScheduleWhatsApp(){
 if(!lastScheduled)return;
 const phone=normalizePhone(lastScheduled.clients?.whatsapp||schedulePhone.value);
 if(!phone){alert('Nomor WhatsApp client tidak tersedia.');return}
 const when=new Intl.DateTimeFormat('id-ID',{
  weekday:'long',day:'2-digit',month:'long',year:'numeric',
  hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'
 }).format(new Date(lastScheduled.scheduled_at));
 const method=lastScheduled.meeting_method||'Meeting';
 const link=lastScheduled.meeting_link?`\n📍 ${lastScheduled.meeting_link}`:'';
 const note=lastScheduled.admin_notes?`\n\nCatatan: ${lastScheduled.admin_notes}`:'';
 const msg=`Halo ${lastScheduled.clients?.full_name||''},\n\nPembayaran dan pendaftaran ${lastScheduled.service_name_snapshot||'konsultasi'} telah kami terima.\n\nJadwal meeting:\n📅 ${when} WIB\n💻 ${method}${link}${note}\n\nNomor Konsultasi: ${lastScheduled.consultation_no}\n\nMohon konfirmasi ketersediaannya. Terima kasih.`;
 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
}

function scheduleButton(x){
 const disabled=Number(x.amount)>0&&x.payment_status!=='paid';
 if(disabled)return '<button class="btn btn-primary" disabled title="Pembayaran belum lunas">Atur Jadwal</button>';
 return `<button class="btn btn-primary" onclick="openScheduleModal('${x.id}')">${x.scheduled_at?'Ubah Jadwal':'Atur Jadwal'}</button>`;
}

async function renderConsultations(){
 try{
  cachedConsultations=await api.listConsultations(bookingFilter.value);
  bookingList.innerHTML=cachedConsultations.map(x=>`<article class="list-card">
   <div class="row">
    <div>
     <h3>${esc(x.service_name_snapshot)}</h3>
     <p>${esc(x.clients?.full_name||'Client')}<br>${esc(x.consultation_no)} · ${fmtDate(x.created_at)}</p>
    </div>
    <span class="badge ${badgeClass(x.consultation_status)}">${statusLabel(x.consultation_status)}</span>
   </div>
   <p><strong>Pembayaran:</strong> ${statusLabel(x.payment_status)} ${Number(x.amount)>0?'· '+rupiah(x.amount):''}</p>
   ${x.scheduled_at?`<div class="schedule-preview"><strong>${fmtDate(x.scheduled_at)}</strong><span>${esc(x.meeting_method||'Meeting')}</span>${x.meeting_link?`<small>${esc(x.meeting_link)}</small>`:''}</div>`:''}
   <div class="actions">
    <a class="btn btn-secondary" href="client-detail.html?id=${encodeURIComponent(x.client_id)}">Client</a>
    ${scheduleButton(x)}
    <button class="btn btn-secondary" onclick="setConsultation('${x.id}','completed')">Selesai</button>
    <button class="btn btn-danger" onclick="setConsultation('${x.id}','cancelled')">Batal</button>
   </div>
  </article>`).join('')||'<div class="empty"><strong>Belum ada konsultasi</strong>Pendaftaran dari Website Personal akan muncul di sini.</div>';
  if(window.lucide)lucide.createIcons();
 }catch(err){
  bookingList.innerHTML=`<div class="empty"><strong>Gagal memuat</strong>${esc(err.message)}</div>`;
 }
}

document.addEventListener('DOMContentLoaded',initBookings);
