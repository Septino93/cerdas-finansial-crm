const db=window.cfSupabase;
function normalizePhone(v){return String(v||'').replace(/\D/g,'').replace(/^0/,'62')}
function rupiah(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function fmtDate(v){if(!v)return'-';return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function statusLabel(v){return ({not_required:'Tidak Perlu Bayar',pending:'Menunggu Pembayaran',paid:'Lunas',failed:'Gagal',expired:'Kedaluwarsa',refunded:'Dikembalikan',waiting_payment:'Menunggu Pembayaran',waiting_schedule:'Menunggu Penjadwalan',confirmed:'Jadwal Dikonfirmasi',completed:'Konsultasi Selesai',cancelled:'Dibatalkan'})[v]||String(v||'')}
function badgeClass(v){return ['paid','confirmed','completed','not_required'].includes(v)?'green':['failed','cancelled','expired'].includes(v)?'red':'orange'}
async function mustData(promise){const {data,error,count}=await promise;if(error)throw error;return count!==null&&count!==undefined?{data,count}:data}
const api={
 async adminProfile(){return mustData(db.from('admin_profiles').select('*').single())},
 async dashboard(){
  const [clients,consultations,payments,recentC,recentClients,profile]=await Promise.all([
   mustData(db.from('clients').select('*',{count:'exact',head:true})),
   mustData(db.from('consultations').select('consultation_status,payment_status')),
   mustData(db.from('payments').select('amount,status')),
   mustData(db.from('consultations').select('id,consultation_no,service_name_snapshot,consultation_status,payment_status,created_at,client_id,clients(full_name)').order('created_at',{ascending:false}).limit(4)),
   mustData(db.from('clients').select('*').order('created_at',{ascending:false}).limit(4)),
   db.from('admin_profiles').select('*').maybeSingle().then(({data})=>data)
  ]);
  return {clientCount:clients.count||0,consultations,payments,recentConsultations:recentC,recentClients,profile};
 },
 async listClients(search=''){
  let q=db.from('clients').select('*').order('created_at',{ascending:false});
  if(search){const s=search.replace(/[%(),]/g,'');q=q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,whatsapp.ilike.%${s}%`)}
  return mustData(q);
 },
 async getClient(id){return mustData(db.from('clients').select('*').eq('id',id).single())},
 async createClient(x){return mustData(db.from('clients').insert({full_name:x.name,email:x.email||null,whatsapp:x.phone,whatsapp_normalized:normalizePhone(x.phone),consultation_credit:Number(x.credit||2)}).select().single())},
 async updateClient(id,x){return mustData(db.from('clients').update(x).eq('id',id).select().single())},
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
 async listPayments(status=''){let q=db.from('payments').select('*,consultations(consultation_no,service_name_snapshot,client_id,clients(full_name))').order('created_at',{ascending:false});if(status)q=q.eq('status',status);return mustData(q)},
 async updatePayment(id,status){const p=await mustData(db.from('payments').update({status,paid_at:status==='paid'?new Date().toISOString():null}).eq('id',id).select('*,consultations(*)').single());if(p.consultation_id){await db.from('consultations').update({payment_status:status,consultation_status:status==='paid'?'waiting_schedule':status==='failed'?'waiting_payment':p.consultations.consultation_status}).eq('id',p.consultation_id)}await this.log({client_id:p.consultations?.client_id,consultation_id:p.consultation_id,payment_id:p.id,event_type:'payment_updated',description:`Pembayaran ${statusLabel(status)}`});return p},
 async listActivities(clientId=''){let q=db.from('activity_logs').select('*,clients(full_name)').order('created_at',{ascending:false});if(clientId)q=q.eq('client_id',clientId);return mustData(q)},
 async clientDetail(id){const [client,consultations,payments,activities]=await Promise.all([this.getClient(id),mustData(db.from('consultations').select('*').eq('client_id',id).order('created_at',{ascending:false})),mustData(db.from('payments').select('*,consultations!inner(client_id,service_name_snapshot)').eq('consultations.client_id',id).order('created_at',{ascending:false})),this.listActivities(id)]);return {client,consultations,payments,activities}},
 async log(row){const {error}=await db.from('activity_logs').insert(row);if(error)console.warn('Activity log gagal:',error.message)},
 async saveProfile(x){const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sesi login tidak ditemukan.');return mustData(db.from('admin_profiles').update({full_name:x.name}).eq('user_id',user.id).select().single())}
};
window.api=api;
