let allClients=[];

const byId=id=>document.getElementById(id);

async function initClients(){
  if(!(await protectPage()))return;

  byId('clientForm')?.addEventListener('submit',addClient);
  byId('searchClient')?.addEventListener('input',()=>{
    toggleClearSearch();
    renderClients();
  });
  byId('clearClientSearch')?.addEventListener('click',()=>{
    byId('searchClient').value='';
    toggleClearSearch();
    renderClients();
    byId('searchClient').focus();
  });
  byId('clientStatusFilter')?.addEventListener('change',renderClients);
  byId('clientSort')?.addEventListener('change',renderClients);

  await loadClients();
}

async function loadClients(){
  try{
    setLoadingState();
    allClients=await api.listClients();
    updateClientStats();
    renderClients();
  }catch(err){
    byId('clientList').innerHTML=`<div class="empty"><strong>Gagal memuat</strong>${esc(err.message)}</div>`;
    byId('clientResultInfo').textContent='Data client gagal dimuat.';
  }
}

async function addClient(e){
  e.preventDefault();
  const submitButton=e.submitter||e.target.querySelector('button[type="submit"],button:not([type])');
  try{
    if(submitButton){submitButton.disabled=true;submitButton.textContent='Menyimpan...';}
    await api.createClient({
      name:byId('clientName').value.trim(),
      phone:byId('clientPhone').value.trim(),
      email:byId('clientEmail').value.trim(),
      credit:Number(byId('clientCredit').value||2)
    });
    e.target.reset();
    byId('clientCredit').value=2;
    await loadClients();
  }catch(err){
    alert('Gagal menyimpan client: '+err.message);
  }finally{
    if(submitButton){submitButton.disabled=false;submitButton.textContent='Simpan Client';}
  }
}

function isClientActive(client){
  if(client?.is_active===false)return false;
  const status=String(client?.status||client?.client_status||'').toLowerCase();
  return !['inactive','nonactive','nonaktif','disabled','archived'].includes(status);
}

function normalizeSearch(value){
  return String(value||'').toLocaleLowerCase('id-ID').replace(/\s+/g,' ').trim();
}

function getFilteredClients(){
  const keyword=normalizeSearch(byId('searchClient')?.value);
  const statusFilter=byId('clientStatusFilter')?.value||'all';
  const sort=byId('clientSort')?.value||'newest';

  const rows=allClients.filter(client=>{
    const active=isClientActive(client);
    const matchesStatus=statusFilter==='all'||(statusFilter==='active'&&active)||(statusFilter==='inactive'&&!active);
    if(!matchesStatus)return false;
    if(!keyword)return true;

    const searchable=normalizeSearch([
      client.full_name,
      client.whatsapp,
      client.whatsapp_normalized,
      client.email
    ].filter(Boolean).join(' '));

    const compactKeyword=keyword.replace(/\D/g,'');
    const compactPhone=String(client.whatsapp_normalized||client.whatsapp||'').replace(/\D/g,'');
    return searchable.includes(keyword)||(compactKeyword&&compactPhone.includes(compactKeyword));
  });

  rows.sort((a,b)=>{
    if(sort==='oldest')return new Date(a.created_at||0)-new Date(b.created_at||0);
    if(sort==='name_asc')return String(a.full_name||'').localeCompare(String(b.full_name||''),'id',{sensitivity:'base'});
    if(sort==='name_desc')return String(b.full_name||'').localeCompare(String(a.full_name||''),'id',{sensitivity:'base'});
    return new Date(b.created_at||0)-new Date(a.created_at||0);
  });

  return rows;
}

function updateClientStats(){
  const active=allClients.filter(isClientActive).length;
  byId('totalClientStat').textContent=allClients.length;
  byId('activeClientStat').textContent=active;
  byId('inactiveClientStat').textContent=allClients.length-active;
}

function renderClients(){
  const rows=getFilteredClients();
  const keyword=byId('searchClient')?.value.trim();
  const status=byId('clientStatusFilter')?.value||'all';
  const hasFilters=Boolean(keyword)||status!=='all';

  byId('clientResultInfo').textContent=hasFilters
    ?`${rows.length} dari ${allClients.length} client ditampilkan`
    :`${rows.length} client tersedia`;

  if(!rows.length){
    const title=hasFilters?'Tidak ada client ditemukan':'Belum ada client';
    const copy=hasFilters?'Coba gunakan kata kunci atau filter lain.':'Data dari Website Personal nantinya otomatis membuat client.';
    byId('clientList').innerHTML=`<div class="empty client-empty-state"><span><i data-lucide="${hasFilters?'search-x':'users'}"></i></span><strong>${title}</strong>${copy}</div>`;
    if(window.lucide)lucide.createIcons();
    return;
  }

  byId('clientList').innerHTML=rows.map(client=>{
    const active=isClientActive(client);
    return `<article class="list-card">
      <div class="row">
        <div class="client-list-copy">
          <div class="client-name-line">
            <h3>${esc(client.full_name)}</h3>
            <span class="badge ${active?'green':'gray'}">${active?'Aktif':'Nonaktif'}</span>
          </div>
          <p>${esc(client.whatsapp||'WA belum diisi')}<br>${esc(client.email||'Email belum diisi')}</p>
        </div>
        <span class="badge blue">${Number(client.consultation_credit||0)} credit</span>
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="client-detail.html?id=${encodeURIComponent(client.id)}">Buka Detail</a>
        <a class="btn btn-secondary" href="client-detail.html?id=${encodeURIComponent(client.id)}&edit=1"><i data-lucide="pencil"></i> Edit</a>
        <button class="btn btn-danger" type="button" onclick="removeClient('${client.id}')">Hapus</button>
      </div>
    </article>`;
  }).join('');

  if(window.lucide)lucide.createIcons();
}

function toggleClearSearch(){
  const button=byId('clearClientSearch');
  if(button)button.hidden=!byId('searchClient')?.value;
}

function setLoadingState(){
  byId('clientList').innerHTML='<div class="empty"><strong>Memuat client...</strong>Mohon tunggu sebentar.</div>';
  byId('clientResultInfo').textContent='Memuat data client...';
}

async function removeClient(id){
  if(!confirm('Hapus client? Data konsultasi yang terkait dapat mencegah penghapusan.'))return;
  try{
    await api.deleteClient(id);
    await loadClients();
  }catch(err){
    alert('Client tidak dapat dihapus: '+err.message);
  }
}

document.addEventListener('DOMContentLoaded',initClients);
