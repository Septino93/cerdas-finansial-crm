const db=window.cfSupabase;
function normalizePhone(v){return String(v||'').replace(/\D/g,'').replace(/^0/,'62')}
function rupiah(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function fmtDate(v){if(!v)return'-';return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function statusLabel(v){return ({not_required:'Tidak Perlu Bayar',pending:'Menunggu Pembayaran',paid:'Lunas',failed:'Gagal',expired:'Kedaluwarsa',refunded:'Dikembalikan',waiting_payment:'Menunggu Pembayaran',waiting_schedule:'Menunggu Penjadwalan',confirmed:'Jadwal Dikonfirmasi',completed:'Konsultasi Selesai',cancelled:'Dibatalkan'})[v]||String(v||'')}
function badgeClass(v){return ['paid','confirmed','completed','not_required'].includes(v)?'green':['failed','cancelled','expired'].includes(v)?'red':'orange'}
async function mustData(promise){const {data,error,count}=await promise;if(error)throw error;return count!==null&&count!==undefined?{data,count}:data}
const api={
 async adminProfile(){
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError)throw userError;
  if(!user)throw new Error('Sesi login tidak ditemukan.');
  const {data,error}=await db.from('admin_profiles').select('*').eq('user_id',user.id).limit(1);
  if(error)throw error;
  return data?.[0]||null;
 },
 async dashboard(){
  const [clients,consultations,payments,recentC,recentClients,recentActivities,profile]=await Promise.all([
   mustData(db.from('clients').select('id,email,whatsapp,created_at',{count:'exact'})),
   mustData(db.from('consultations').select('id,consultation_no,client_id,service_name_snapshot,amount,consultation_status,payment_status,scheduled_at,created_at,updated_at,clients(full_name)')),
   mustData(db.from('payments').select('id,consultation_id,amount,status,paid_at,created_at,updated_at')),
   mustData(db.from('consultations').select('id,consultation_no,service_name_snapshot,consultation_status,payment_status,scheduled_at,created_at,client_id,clients(full_name)').order('created_at',{ascending:false}).limit(5)),
   mustData(db.from('clients').select('*').order('created_at',{ascending:false}).limit(5)),
   mustData(db.from('activity_logs').select('id,event_type,description,created_at,client_id,metadata,clients(full_name)').order('created_at',{ascending:false}).limit(250)),
   db.auth.getUser().then(async({data:{user}})=>{
    if(!user)return null;
    const {data}=await db.from('admin_profiles').select('*').eq('user_id',user.id).limit(1);
    return data?.[0]||null;
   })
  ]);
  const linkedConsultationIds=new Set((payments||[]).map(p=>p.consultation_id).filter(Boolean));
  const syntheticPayments=(consultations||[])
   .filter(c=>Number(c.amount||0)>0&&!linkedConsultationIds.has(c.id))
   .map(c=>({
    id:`consultation-${c.id}`,
    consultation_id:c.id,
    amount:Number(c.amount||0),
    status:c.payment_status||'pending',
    paid_at:c.payment_status==='paid'?(c.updated_at||c.created_at):null,
    created_at:c.created_at,
    updated_at:c.updated_at,
    is_virtual:true
   }));
  const dashboardPayments=[...(payments||[]),...syntheticPayments];
  return {clientCount:clients.count||0,clients:clients.data||[],consultations,payments:dashboardPayments,recentConsultations:recentC,recentClients,recentActivities:(recentActivities||[]).slice(0,5),activities:recentActivities||[],profile};
 },
 async listClients(search=''){
  let q=db.from('clients').select('*').order('created_at',{ascending:false});
  if(search){const s=search.replace(/[%(),]/g,'');q=q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,whatsapp.ilike.%${s}%`)}
  return mustData(q);
 },
 async getClient(id){return mustData(db.from('clients').select('*').eq('id',id).single())},
 async createClient(x){return mustData(db.from('clients').insert({full_name:x.name,email:x.email||null,whatsapp:x.phone,whatsapp_normalized:normalizePhone(x.phone),consultation_credit:Number(x.credit||2)}).select().single())},
 async updateClient(id,x){return mustData(db.from('clients').update(x).eq('id',id).select().single())},
 async setClientActive(id,isActive){return this.updateClient(id,{is_active:Boolean(isActive)})},
 async deleteClient(id){return mustData(db.from('clients').delete().eq('id',id))},
 async services(){return mustData(db.from('services').select('*').eq('is_active',true).order('sort_order'))},
 async listConsultations(status=''){
  let q=db.from('consultations').select('*,clients(full_name,email,whatsapp),services(slug,name)').order('created_at',{ascending:false});
  if(status)q=q.eq('consultation_status',status);
  return mustData(q);
 },
 async createConsultation(x){
  const c=await this.getClient(x.clientId),services=await this.services(),s=services.find(v=>v.id===x.serviceId);if(!s)throw new Error('Layanan tidak ditemukan.');
  let creditUsed=0,amount=s.price,paymentStatus='pending',consultationStatus='waiting_payment';
  if(x.method==='free_credit'&&s.uses_credit&&Number(c.consultation_credit)>0){creditUsed=1;amount=0;paymentStatus='not_required';consultationStatus='waiting_schedule';await this.updateClient(c.id,{consultation_credit:Number(c.consultation_credit)-1})}
  const consultation=await mustData(db.from('consultations').insert({client_id:c.id,service_id:s.id,service_name_snapshot:s.name,amount,credit_used:creditUsed,payment_status:paymentStatus,consultation_status:consultationStatus,admin_notes:x.notes||null}).select().single());
  if(amount>0)await mustData(db.from('payments').insert({consultation_id:consultation.id,amount,status:'pending',provider:'midtrans'}));
  await this.log({client_id:c.id,consultation_id:consultation.id,event_type:'consultation_registered',description:'Pendaftaran konsultasi dibuat oleh admin'});
  return consultation;
 },
 async updateConsultation(id,x){const c=await mustData(db.from('consultations').update(x).eq('id',id).select().single());await this.log({client_id:c.client_id,consultation_id:c.id,event_type:'consultation_updated',description:`Status konsultasi: ${statusLabel(c.consultation_status)}`});return c},
 async scheduleConsultation(id,x){
  const scheduledAt=new Date(`${x.date}T${x.time}:00`).toISOString();
  const payload={
   scheduled_at:scheduledAt,
   meeting_method:x.method,
   meeting_link:x.link||null,
   admin_notes:x.notes||null,
   consultation_status:'confirmed'
  };
  const c=await mustData(db.from('consultations').update(payload).eq('id',id).select('*,clients(full_name,whatsapp,email)').single());
  await this.log({
   client_id:c.client_id,
   consultation_id:c.id,
   event_type:'consultation_scheduled',
   description:`Jadwal konsultasi dikonfirmasi: ${fmtDate(c.scheduled_at)}`,
   metadata:{meeting_method:c.meeting_method,meeting_link:c.meeting_link||null}
  });
  return c;
 },
 async listPayments(status=''){
  const [paymentRows,consultationRows]=await Promise.all([
   mustData(db.from('payments').select('*,consultations(consultation_no,service_name_snapshot,client_id,clients(full_name))').order('created_at',{ascending:false})),
   mustData(db.from('consultations').select('id,consultation_no,client_id,service_name_snapshot,amount,payment_status,created_at,updated_at,clients(full_name)').gt('amount',0).order('created_at',{ascending:false}))
  ]);

  const linkedConsultationIds=new Set((paymentRows||[]).map(p=>p.consultation_id).filter(Boolean));
  const synthetic=(consultationRows||[])
   .filter(c=>!linkedConsultationIds.has(c.id))
   .map(c=>({
    id:`consultation-${c.id}`,
    consultation_id:c.id,
    invoice_no:c.consultation_no,
    amount:Number(c.amount||0),
    status:c.payment_status||'pending',
    provider:'midtrans',
    paid_at:c.payment_status==='paid'?(c.updated_at||c.created_at):null,
    created_at:c.created_at,
    updated_at:c.updated_at,
    is_virtual:true,
    consultations:{
     consultation_no:c.consultation_no,
     service_name_snapshot:c.service_name_snapshot,
     client_id:c.client_id,
     clients:c.clients
    }
   }));

  let rows=[...(paymentRows||[]),...synthetic]
   .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

  if(status)rows=rows.filter(p=>p.status===status);
  return rows;
 },
 async updatePayment(id,status){const p=await mustData(db.from('payments').update({status,paid_at:status==='paid'?new Date().toISOString():null}).eq('id',id).select('*,consultations(*)').single());if(p.consultation_id){await db.from('consultations').update({payment_status:status,consultation_status:status==='paid'?'waiting_schedule':status==='failed'?'waiting_payment':p.consultations.consultation_status}).eq('id',p.consultation_id)}await this.log({client_id:p.consultations?.client_id,consultation_id:p.consultation_id,payment_id:p.id,event_type:'payment_updated',description:`Pembayaran ${statusLabel(status)}`});return p},
 async saveConsultationResult(x){
  if(!x.clientId)throw new Error('Client belum dipilih.');
  if(!Array.isArray(x.topics)||!x.topics.length)throw new Error('Pilih minimal satu topik yang dikerjakan.');
  if(x.consultationId){
   await mustData(db.from('consultations').update({consultation_status:'completed'}).eq('id',x.consultationId).select().single());
  }
  const description=`Hasil konsultasi disimpan ke CRM: ${x.topics.join(', ')}`;
  return mustData(db.from('activity_logs').insert({
   client_id:x.clientId,
   consultation_id:x.consultationId||null,
   event_type:'consultation_result_uploaded',
   description,
   metadata:{
    source:'analysis_workspace',
    consultation_date:x.consultationDate,
    topics:x.topics,
    recommendation:x.recommendation||'',
    notes:x.notes||'',
    follow_up_date:x.followUpDate||null
   }
  }).select().single());
 },
 async listActivities(clientId=''){let q=db.from('activity_logs').select('*,clients(full_name)').order('created_at',{ascending:false});if(clientId)q=q.eq('client_id',clientId);return mustData(q)},
 async clientDetail(id){
  const [client,consultations,paymentRows,activities]=await Promise.all([
   this.getClient(id),
   mustData(db.from('consultations').select('*').eq('client_id',id).order('created_at',{ascending:false})),
   mustData(db.from('payments').select('*,consultations!inner(client_id,consultation_no,service_name_snapshot)').eq('consultations.client_id',id).order('created_at',{ascending:false})),
   this.listActivities(id)
  ]);

  const linkedConsultationIds=new Set((paymentRows||[]).map(p=>p.consultation_id).filter(Boolean));
  const synthetic=(consultations||[])
   .filter(c=>Number(c.amount||0)>0&&!linkedConsultationIds.has(c.id))
   .map(c=>({
    id:`consultation-${c.id}`,
    consultation_id:c.id,
    invoice_no:c.consultation_no,
    amount:Number(c.amount||0),
    status:c.payment_status||'pending',
    provider:'midtrans',
    paid_at:c.payment_status==='paid'?(c.updated_at||c.created_at):null,
    created_at:c.created_at,
    updated_at:c.updated_at,
    is_virtual:true,
    consultations:{
     client_id:c.client_id,
     consultation_no:c.consultation_no,
     service_name_snapshot:c.service_name_snapshot
    }
   }));

  const payments=[...(paymentRows||[]),...synthetic]
   .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

  return {client,consultations,payments,activities};
 },
 async log(row){const {error}=await db.from('activity_logs').insert(row);if(error)console.warn('Activity log gagal:',error.message)},
 async addClientActivity(clientId,eventType,description,metadata={}){return mustData(db.from('activity_logs').insert({client_id:clientId,event_type:eventType,description,metadata}).select().single())},
 async updateActivity(id,payload){return mustData(db.from('activity_logs').update(payload).eq('id',id).select().single())},
 async uploadClientDocument(clientId,file,meta={}){const safe=String(file.name||'file').replace(/[^a-zA-Z0-9._-]/g,'-'),path=`${clientId}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safe}`;const {error}=await db.storage.from('client-documents').upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;try{return await mustData(db.from('activity_logs').insert({client_id:clientId,consultation_id:meta.consultationId||null,event_type:'document_uploaded',description:`Dokumen diupload: ${meta.title||file.name}`,metadata:{title:meta.title||file.name,category:meta.category||'Lainnya',filename:file.name,path,size:file.size,type:file.type,public_for_client:Boolean(meta.publicForClient)}}).select().single())}catch(e){await db.storage.from('client-documents').remove([path]);throw e}},
 async updateClientDocument(activityId,payload={}){const current=await mustData(db.from('activity_logs').select('*').eq('id',activityId).single()),metadata={...(current.metadata||{}),title:payload.title||current.metadata?.title||current.metadata?.filename,category:payload.category||current.metadata?.category||'Lainnya',public_for_client:Boolean(payload.publicForClient)};return mustData(db.from('activity_logs').update({consultation_id:payload.consultationId||null,description:`Dokumen diperbarui: ${metadata.title}`,metadata}).eq('id',activityId).select().single())},
 async deleteClientDocument(activityId){const current=await mustData(db.from('activity_logs').select('*').eq('id',activityId).single()),path=current.metadata?.path;if(path){const {error}=await db.storage.from('client-documents').remove([path]);if(error)throw error}return mustData(db.from('activity_logs').delete().eq('id',activityId))},
 async getClientDocumentUrl(activityId){const current=await mustData(db.from('activity_logs').select('metadata').eq('id',activityId).single()),path=current.metadata?.path;if(!path)throw new Error('Lokasi file tidak tersedia.');const {data,error}=await db.storage.from('client-documents').createSignedUrl(path,600);if(error)throw error;return data.signedUrl},
 async saveProfile(x){
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError)throw userError;
  if(!user)throw new Error('Sesi login tidak ditemukan.');

  const fullName=String(x?.name||'').trim();
  if(!fullName)throw new Error('Nama profesional wajib diisi.');

  // Jangan memakai .single()/.maybeSingle() agar tidak terjadi error
  // "Cannot coerce the result to a single JSON object".
  const {data:updated,error:updateError}=await db
   .from('admin_profiles')
   .update({full_name:fullName})
   .eq('user_id',user.id)
   .select('*');
  if(updateError)throw updateError;
  if(Array.isArray(updated)&&updated.length>0)return updated[0];

  // Hanya dijalankan bila profil akun belum pernah dibuat.
  const {data:inserted,error:insertError}=await db
   .from('admin_profiles')
   .insert({user_id:user.id,full_name:fullName,role:'super_admin',is_active:true})
   .select('*');
  if(insertError)throw insertError;
  return inserted?.[0]||{user_id:user.id,full_name:fullName};
 }
};
window.api=api;
