let paymentRows=[];
async function initPayments(){if(!(await protectPage()))return;paymentFilter.addEventListener('change',renderPayments);await renderPayments()}

async function setPayment(id,status){
 try{
  await api.updatePayment(id,status);
  await renderPayments();
 }catch(err){alert(err.message)}
}

function paymentDate(p){
 const value=p.status==='paid'?(p.paid_at||p.updated_at||p.created_at):(p.created_at||p.updated_at);
 return fmtDate(value);
}

function getPaymentByKey(key){return paymentRows.find(p=>String(p.id)===String(key))}
function downloadInvoice(key){const p=getPaymentByKey(key);if(!p)return alert('Data pembayaran tidak ditemukan.');try{window.cfDocuments.downloadInvoice(p)}catch(err){alert(err.message)}}
function downloadReceipt(key){const p=getPaymentByKey(key);if(!p)return alert('Data pembayaran tidak ditemukan.');try{window.cfDocuments.downloadReceipt(p)}catch(err){alert(err.message)}}

async function renderPayments(){
 try{
  paymentRows=await api.listPayments(paymentFilter.value);
  paymentList.innerHTML=paymentRows.map(p=>{
   const client=p.consultations?.clients?.full_name||'Client';
   const service=p.consultations?.service_name_snapshot||'Konsultasi';
   const number=p.invoice_no||p.consultations?.consultation_no||'-';
   const provider=p.provider==='midtrans'?'Midtrans':(p.provider||'-');
   const controls=p.is_virtual
    ?'<span class="badge blue">Sinkron dari transaksi</span>'
    :`<button class="btn btn-primary" onclick="setPayment('${p.id}','paid')">Tandai Lunas</button><button class="btn btn-danger" onclick="setPayment('${p.id}','failed')">Gagal</button>`;
   const documentButtons=`<button class="btn btn-secondary" onclick="downloadInvoice('${p.id}')"><i data-lucide="file-text"></i> Invoice PDF</button>${p.status==='paid'?`<button class="btn btn-primary" onclick="downloadReceipt('${p.id}')"><i data-lucide="badge-check"></i> Receipt PDF</button>`:''}`;

   return `<article class="list-card">
    <div class="row">
     <div>
      <h3>${esc(number)}</h3>
      <p>${esc(client)} · ${esc(service)}<br>${paymentDate(p)} · ${esc(provider)}</p>
     </div>
     <span class="badge ${badgeClass(p.status)}">${statusLabel(p.status)}</span>
    </div>
    <h3 style="margin-top:12px">${rupiah(p.amount)}</h3>
    <div class="actions">
     <a class="btn btn-secondary" href="client-detail.html?id=${encodeURIComponent(p.consultations?.client_id||'')}">Client</a>
     ${documentButtons}
     ${controls}
    </div>
   </article>`;
  }).join('')||'<div class="empty"><strong>Belum ada pembayaran</strong>Transaksi Midtrans akan muncul di sini.</div>';
  if(window.lucide)lucide.createIcons();
 }catch(err){
  paymentList.innerHTML=`<div class="empty"><strong>Gagal memuat</strong>${esc(err.message)}</div>`;
 }
}
document.addEventListener('DOMContentLoaded',initPayments);
