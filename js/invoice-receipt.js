(function(){
  const BRAND={name:'CERDAS FINANSIAL',tagline:'Financial Planning & Insurance Advisory',planner:'Septino, QWP®, CIS®'};
  const NAVY=[11,60,93],BLUE=[25,118,210],TEXT=[35,48,67],MUTED=[100,116,135],LINE=[222,230,238],PALE=[242,247,252],GREEN=[22,125,72];
  function safeFile(v){return String(v||'dokumen').replace(/[^a-zA-Z0-9-_]+/g,'-').replace(/^-+|-+$/g,'')}
  function money(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
  function dateOnly(v){if(!v)return'-';return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(v))}
  function dateTime(v){if(!v)return'-';return new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short'}).format(new Date(v))}
  function baseNo(p){return p.invoice_no||p.consultations?.consultation_no||p.consultation_no||String(p.id||'DOC').slice(0,12).toUpperCase()}
  function docNumber(p,type){const raw=baseNo(p).replace(/[^A-Za-z0-9]/g,'').slice(-14);return `${type==='receipt'?'RCT':'INV'}-${raw}`}
  function client(p){return p.consultations?.clients?.full_name||p.client_name||'Client'}
  function email(p){return p.consultations?.clients?.email||p.client_email||'-'}
  function phone(p){return p.consultations?.clients?.whatsapp||p.client_phone||'-'}
  function service(p){return p.consultations?.service_name_snapshot||p.service_name||'Konsultasi Finansial'}
  function ctor(){const x=window.jspdf?.jsPDF;if(!x)throw new Error('Library PDF belum termuat.');return x}
  function setColor(doc,c){doc.setTextColor(...c)}

  let brandLogoPromise=null;
  function loadBrandLogo(){
    if(brandLogoPromise)return brandLogoPromise;
    brandLogoPromise=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src='../assets/images/logo-cerdas-finansial.png';
    });
    return brandLogoPromise;
  }
  function text(doc,value,x,y,size=10,style='normal',align='left'){doc.setFont('helvetica',style);doc.setFontSize(size);doc.text(String(value??'-'),x,y,{align})}
  function watermark(doc){doc.setTextColor(238,243,248);doc.setFont('helvetica','bold');doc.setFontSize(58);doc.text('CF',105,162,{align:'center',angle:25});}
  function header(doc,type,no,status,logo){
    doc.setFillColor(...NAVY);doc.rect(0,0,210,50,'F');
    doc.setFillColor(214,166,37);doc.rect(0,0,6,50,'F');
    if(logo){
      try{doc.addImage(logo,'PNG',14,7,43,34,undefined,'FAST')}catch(e){console.warn('Logo PDF gagal dimuat',e)}
    }else{
      doc.setFillColor(255,255,255);doc.roundedRect(18,12,24,24,6,6,'F');setColor(doc,NAVY);text(doc,'CF',30,28,12,'bold','center');
    }
    doc.setTextColor(255,255,255);
    text(doc,type==='receipt'?'RECEIPT':'INVOICE',192,18,18,'bold','right');text(doc,no,192,27,8.5,'normal','right');
    const paid=status==='paid'||type==='receipt';doc.setFillColor(...(paid?GREEN:[181,112,9]));doc.roundedRect(153,34,39,8,4,4,'F');doc.setTextColor(255,255,255);text(doc,paid?'LUNAS':'MENUNGGU',172.5,39.6,7.5,'bold','center');
  }
  function field(doc,label,value,x,y,w=74){setColor(doc,MUTED);text(doc,label.toUpperCase(),x,y,7.5,'bold');setColor(doc,TEXT);const lines=doc.splitTextToSize(String(value||'-'),w);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(lines,x,y+6);return lines.length}
  function footer(doc,no){doc.setDrawColor(...LINE);doc.line(18,276,192,276);setColor(doc,MUTED);text(doc,'Dokumen elektronik Cerdas Finansial',18,283,7.5);text(doc,no,105,283,7.5,'normal','center');setColor(doc,NAVY);text(doc,BRAND.planner,192,283,7.5,'bold','right')}
  async function qrData(value){if(!window.QRCode?.toDataURL)return null;try{return await window.QRCode.toDataURL(value,{margin:1,width:220,errorCorrectionLevel:'M'})}catch{return null}}
  async function makePdf(p,type){
    if(type==='receipt'&&p.status!=='paid')throw new Error('Receipt hanya tersedia untuk pembayaran lunas.');
    const Doc=ctor(),doc=new Doc({unit:'mm',format:'a4',orientation:'portrait'}),no=docNumber(p,type),isReceipt=type==='receipt';
    const logo=await loadBrandLogo();
    watermark(doc);header(doc,type,no,p.status,logo);
    field(doc,'Ditagihkan kepada',client(p),18,62,75);field(doc,'Diterbitkan oleh',BRAND.planner,112,62,80);
    field(doc,'WhatsApp',phone(p),18,82,75);field(doc,'Email',email(p),18,98,75);
    field(doc,isReceipt?'Tanggal pembayaran':'Tanggal invoice',dateOnly(isReceipt?(p.paid_at||p.updated_at):p.created_at),112,82,80);
    field(doc,'Nomor konsultasi',p.consultations?.consultation_no||p.invoice_no||'-',112,98,80);
    if(isReceipt){field(doc,'Metode pembayaran',String(p.payment_type||p.provider||'Midtrans').toUpperCase(),112,114,80);field(doc,'Waktu transaksi',dateTime(p.paid_at||p.updated_at),18,114,80)}
    const y=isReceipt?137:122;
    doc.setFillColor(...NAVY);doc.roundedRect(18,y,174,12,2,2,'F');doc.setTextColor(255,255,255);text(doc,'DESKRIPSI',24,y+8,8.5,'bold');text(doc,'JUMLAH',186,y+8,8.5,'bold','right');
    doc.setFillColor(255,255,255);doc.roundedRect(18,y+12,174,29,0,0,'F');setColor(doc,TEXT);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(doc.splitTextToSize(service(p),110),24,y+24);text(doc,money(p.amount),186,y+25,11,'bold','right');doc.setDrawColor(...LINE);doc.line(18,y+41,192,y+41);
    doc.setFillColor(...PALE);doc.roundedRect(108,y+49,84,31,4,4,'F');setColor(doc,MUTED);text(doc,isReceipt?'TOTAL DITERIMA':'TOTAL TAGIHAN',116,y+61,8,'bold');setColor(doc,NAVY);text(doc,money(p.amount),185,y+72,17,'bold','right');
    const noteY=y+94;setColor(doc,isReceipt?GREEN:NAVY);text(doc,isReceipt?'PEMBAYARAN BERHASIL':'INFORMASI PEMBAYARAN',18,noteY,10,'bold');setColor(doc,MUTED);doc.setFont('helvetica','normal');doc.setFontSize(9);const note=isReceipt?'Pembayaran telah diterima. Simpan dokumen ini sebagai bukti pembayaran resmi.':'Selesaikan pembayaran hanya melalui halaman resmi yang diberikan oleh Cerdas Finansial. Invoice ini tidak memuat nomor rekening pribadi.';doc.text(doc.splitTextToSize(note,118),18,noteY+7);
    const verify=`CF|${type}|${no}|${baseNo(p)}|${Number(p.amount||0)}|${p.status||'pending'}`;const qr=await qrData(verify);if(qr){doc.addImage(qr,'PNG',158,noteY-3,28,28);setColor(doc,MUTED);text(doc,'VERIFIKASI DOKUMEN',172,noteY+30,6.5,'bold','center')}
    footer(doc,no);doc.save(`${isReceipt?'Receipt':'Invoice'}-${safeFile(baseNo(p))}.pdf`);
  }
  window.cfDocuments={downloadInvoice:p=>makePdf(p,'invoice'),downloadReceipt:p=>makePdf(p,'receipt')};
})();