const CF_TEMPLATE_KEY='cf_crm_communication_templates_v1';
const CF_DEFAULT_TEMPLATES={
 booking:{label:'Booking diterima',text:'Halo {{nama}},\n\nBooking {{layanan}} Anda telah kami terima.\nNomor konsultasi: {{nomor}}\n\nKami akan menginformasikan proses berikutnya melalui WhatsApp. Terima kasih.'},
 payment:{label:'Pembayaran berhasil',text:'Halo {{nama}},\n\nPembayaran {{layanan}} sebesar {{jumlah}} telah kami terima.\nNomor konsultasi: {{nomor}}\n\nTerima kasih.'},
 schedule:{label:'Jadwal konsultasi',text:'Halo {{nama}},\n\nJadwal {{layanan}} Anda telah dikonfirmasi.\n\n📅 {{tanggal}}\n🕘 {{jam}} WIB\n💻 {{metode}}\n📍 {{link}}\n\nNomor konsultasi: {{nomor}}\n\nMohon konfirmasi ketersediaannya. Terima kasih.'},
 reminder:{label:'Reminder H-1',text:'Halo {{nama}},\n\nMengingatkan bahwa besok kita memiliki jadwal {{layanan}}.\n\n📅 {{tanggal}}\n🕘 {{jam}} WIB\n💻 {{metode}}\n📍 {{link}}\n\nSampai jumpa. Terima kasih.'},
 thanks:{label:'Terima kasih',text:'Halo {{nama}},\n\nTerima kasih telah mengikuti {{layanan}} bersama Cerdas Finansial. Semoga sesi hari ini bermanfaat dan membantu Anda mengambil keputusan finansial yang lebih baik.\n\nSalam,\nSeptino, QWP®, CIS®'}
};
function cfGetTemplates(){try{return {...CF_DEFAULT_TEMPLATES,...JSON.parse(localStorage.getItem(CF_TEMPLATE_KEY)||'{}')}}catch{return {...CF_DEFAULT_TEMPLATES}}}
function cfSaveTemplates(v){localStorage.setItem(CF_TEMPLATE_KEY,JSON.stringify(v))}
function cfDateParts(value){if(!value)return{tanggal:'Belum dijadwalkan',jam:'-'};const d=new Date(value);return{tanggal:new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(d),jam:new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(d).replace('.',':')}}
function cfVars(x){const p=cfDateParts(x.scheduled_at);return{nama:x.clients?.full_name||'Bapak/Ibu',layanan:x.service_name_snapshot||'konsultasi',nomor:x.consultation_no||'-',jumlah:typeof rupiah==='function'?rupiah(x.amount||0):String(x.amount||0),tanggal:p.tanggal,jam:p.jam,metode:x.meeting_method||'Belum ditentukan',link:x.meeting_link||'-'}}
function cfRender(text,vars){return String(text||'').replace(/{{\s*(\w+)\s*}}/g,(_,k)=>vars[k]??'')}
function cfPhone(v){return typeof normalizePhone==='function'?normalizePhone(v):String(v||'').replace(/\D/g,'')}
window.CFCommunications={defaults:CF_DEFAULT_TEMPLATES,getTemplates:cfGetTemplates,saveTemplates:cfSaveTemplates,vars:cfVars,render:cfRender,phone:cfPhone};
