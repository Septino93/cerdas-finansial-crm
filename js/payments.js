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

async function renderPayments(){
 try{
  const rows=await api.listPayments(paymentFilter.value);
  paymentList.innerHTML=rows.map(p=>{
   const client=p.consultations?.clients?.full_name||'Client';
   const service=p.consultations?.service_name_snapshot||'Konsultasi';
   const number=p.invoice_no||p.consultations?.consultation_no||'-';
   const provider=p.provider==='midtrans'?'Midtrans':(p.provider||'-');
   const controls=p.is_virtual
    ?'<span class="badge blue">Sinkron dari transaksi</span>'
    :`<button class="btn btn-primary" onclick="setPayment('${p.id}','paid')">Tandai Lunas</button><button class="btn btn-danger" onclick="setPayment('${p.id}','failed')">Gagal</button>`;

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
     ${controls}
    </div>
   </article>`;
  }).join('')||'<div class="empty"><strong>Belum ada pembayaran</strong>Transaksi Midtrans akan muncul di sini.</div>';
 }catch(err){
  paymentList.innerHTML=`<div class="empty"><strong>Gagal memuat</strong>${esc(err.message)}</div>`;
 }
}
document.addEventListener('DOMContentLoaded',initPayments);
