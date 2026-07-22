let cachedClients=[],cachedServices=[],cachedConsultations=[],lastScheduled=null,activeCommunication=null;

async function initBookings(){
 if(!(await protectPage()))return;
 bookingForm.addEventListener('submit',addConsultation);
 openBookingModal?.addEventListener('click',showBookingModal);
 closeBookingModal?.addEventListener('click',hideBookingModal);
 cancelBookingModal?.addEventListener('click',hideBookingModal);
 bookingModalBackdrop?.addEventListener('click',hideBookingModal);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!bookingAddModal.hidden)hideBookingModal()});
 bookingFilter.addEventListener('change',renderConsultations);
 scheduleForm.addEventListener('submit',saveSchedule);
 sendScheduleWaBtn.addEventListener('click',sendScheduleWhatsApp);
 document.querySelectorAll('[data-close-schedule]').forEach(el=>el.addEventListener('click',closeScheduleModal));
 document.querySelectorAll('[data-close-communication]').forEach(el=>el.addEventListener('click',closeCommunicationModal));
 followUpForm?.addEventListener('submit',saveFollowUp);
 [cachedClients,cachedServices]=await Promise.all([api.listClients(),api.services()]);
 bookingClient.innerHTML='<option value="">Pilih client</option>'+cachedClients.map(c=>`<option value="${c.id}">${esc(c.full_name)}</option>`).join('');
 bookingService.innerHTML=cachedServices.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
 scheduleDate.min=new Date().toISOString().slice(0,10);
 await renderConsultations();
}

function showBookingModal(){
 bookingAddModal.hidden=false;
 bookingAddModal.setAttribute('aria-hidden','false');
 document.body.classList.add('client-modal-open');
 requestAnimationFrame(()=>bookingAddModal.classList.add('is-open'));
 setTimeout(()=>bookingClient?.focus(),180);
 if(window.lucide)lucide.createIcons();
}

function hideBookingModal(){
 bookingAddModal.classList.remove('is-open');
 bookingAddModal.setAttribute('aria-hidden','true');
 document.body.classList.remove('client-modal-open');
 setTimeout(()=>{bookingAddModal.hidden=true},240);
}

async function addConsultation(e){
 e.preventDefault();
 const submit=e.submitter;
 if(submit){submit.disabled=true;submit.textContent='Menyimpan...'}
 try{
  await api.createConsultation({
   clientId:bookingClient.value,
   serviceId:bookingService.value,
   method:bookingMethod.value,
   notes:bookingNotes.value.trim()
  });
  e.target.reset();
  hideBookingModal();
  await renderConsultations();
 }catch(err){alert('Gagal membuat konsultasi: '+err.message)}
 finally{if(submit){submit.disabled=false;submit.textContent='Buat Konsultasi'}}
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
  const proofMap=await api.paymentProofs();
  cachedConsultations=cachedConsultations.map(x=>{const proof=proofMap[x.id]||null;return {...x,paymentProof:proof,payment_status:(proof&&x.payment_status==='pending')?'verification':x.payment_status};});
  bookingList.innerHTML=cachedConsultations.map(x=>`<article class="list-card">
   <div class="row">
    <div>
     <h3>${esc(x.service_name_snapshot)}</h3>
     <p>${esc(x.clients?.full_name||'Client')}<br>${esc(x.consultation_no)} · ${fmtDate(x.created_at)}</p>
    </div>
    <span class="badge ${badgeClass(x.consultation_status)}">${statusLabel(x.consultation_status)}</span>
   </div>
   <p><strong>Pembayaran:</strong> ${statusLabel(x.payment_status)} ${Number(x.amount)>0?'· '+rupiah(x.amount):''}</p>
   ${x.paymentProof?`<div class="schedule-preview"><strong>${x.payment_status==='paid'?'Pembayaran sudah disetujui':x.payment_status==='failed'?'Bukti pembayaran ditolak':'Bukti pembayaran menunggu verifikasi'}</strong><span>${fmtDate(x.paymentProof.created_at)}</span></div>`:''}
   ${x.scheduled_at?`<div class="schedule-preview"><strong>${fmtDate(x.scheduled_at)}</strong><span>${esc(x.meeting_method||'Meeting')}</span>${x.meeting_link?`<small>${esc(x.meeting_link)}</small>`:''}</div>`:''}
   <div class="actions">
    <a class="btn btn-secondary" href="client-detail.html?id=${encodeURIComponent(x.client_id)}">Client</a>
    ${x.paymentProof?`<button class="btn btn-secondary" onclick="viewPaymentProof('${x.paymentProof.id}')">Lihat Bukti</button>${x.payment_status==='verification'||x.payment_status==='pending'?`<button class="btn btn-primary" onclick="verifyPayment('${x.id}','paid')">Approve</button><button class="btn btn-danger" onclick="verifyPayment('${x.id}','failed')">Reject</button>`:''}`:''}
    <button class="btn btn-secondary" onclick="openCommunicationCenter('${x.id}')">WhatsApp</button>
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



function openCommunicationCenter(id){
 const x=cachedConsultations.find(v=>v.id===id);if(!x)return;
 activeCommunication=x;
 communicationTitle.textContent='Komunikasi Client';
 communicationService.textContent=x.service_name_snapshot||'Konsultasi';
 communicationClient.textContent=x.clients?.full_name||'Client';
 communicationNumber.textContent=x.consultation_no||'-';
 const templates=CFCommunications.getTemplates();
 const available=[
  ['booking','message-circle','Booking diterima'],
  ['payment','badge-check','Pembayaran berhasil'],
  ['schedule','calendar-check','Jadwal konsultasi'],
  ['reminder','bell-ring','Reminder H-1'],
  ['thanks','heart-handshake','Terima kasih']
 ];
 communicationActions.innerHTML=available.map(([key,icon,label])=>`<div class="communication-template-card"><span class="template-icon"><i data-lucide="${icon}"></i></span><div><strong>${esc(templates[key]?.label||label)}</strong><small>Pesan otomatis terisi dari data konsultasi</small></div><button type="button" class="btn btn-secondary" onclick="sendCommunication('${key}')">Kirim</button></div>`).join('');
 followUpDate.min=new Date().toISOString().slice(0,10);followUpDate.value='';followUpNotes.value='';
 communicationModal.hidden=false;document.body.style.overflow='hidden';if(window.lucide)lucide.createIcons();
}
function closeCommunicationModal(){communicationModal.hidden=true;document.body.style.overflow='';activeCommunication=null}
async function sendCommunication(type){
 const x=activeCommunication;if(!x)return;
 const phone=CFCommunications.phone(x.clients?.whatsapp||'');if(!phone){alert('Nomor WhatsApp client tidak tersedia.');return}
 const t=CFCommunications.getTemplates()[type];if(!t){alert('Template tidak ditemukan.');return}
 const msg=CFCommunications.render(t.text,CFCommunications.vars(x));
 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
 try{await api.log({client_id:x.client_id,consultation_id:x.id,event_type:`communication_${type}`,description:`WhatsApp ${t.label} dibuka untuk ${x.clients?.full_name||'client'}`,metadata:{channel:'whatsapp',template:type}})}catch(err){console.warn(err)}
}
async function saveFollowUp(e){
 e.preventDefault();const x=activeCommunication;if(!x)return;
 try{await api.log({client_id:x.client_id,consultation_id:x.id,event_type:'follow_up_scheduled',description:`Follow up dijadwalkan pada ${fmtDate(followUpDate.value)}`,metadata:{follow_up_date:followUpDate.value,notes:followUpNotes.value.trim()}});alert('Follow up berhasil disimpan.');followUpForm.reset()}catch(err){alert('Gagal menyimpan follow up: '+err.message)}
}

document.addEventListener('DOMContentLoaded',initBookings);

async function viewPaymentProof(activityId){try{const url=await api.paymentProofUrl(activityId);window.open(url,'_blank','noopener')}catch(e){alert(e.message)}}
async function verifyPayment(id,status){
 let reason='';
 if(status==='paid'){
  if(!confirm('Setujui pembayaran ini dan tandai sebagai Lunas?'))return;
 }else{
  reason=prompt('Alasan penolakan bukti pembayaran:','Bukti transfer tidak jelas atau nominal tidak sesuai.');
  if(reason===null)return;
  reason=reason.trim();
  if(!reason){alert('Alasan penolakan wajib diisi.');return}
 }
 try{
  await api.verifyManualPayment(id,status,reason);
  alert(status==='paid'?'Pembayaran berhasil disetujui dan status menjadi Lunas.':'Bukti pembayaran ditolak. Client dapat mengunggah ulang bukti transfer.');
  await renderConsultations();
 }catch(e){alert(e.message)}
}
