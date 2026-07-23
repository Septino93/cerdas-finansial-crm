const CONFIG = {
  SPREADSHEET_ID: "17SfK8dKtYdg_HMyx9Hy8QnnizrwG7ZakKQuBE2HxJ_0",
  SHEET_NAME: "Data",
  DRIVE_FOLDER_ID: "1R5Cq-zadE0AIXnT_ATLgjBIGWNq5JKem",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "Lina16894",
  SESSION_SECRET: "FRP-2026-Septino-8xK4pL9mQ2vN7sR5",
  SESSION_HOURS: 12,
  CRM_SUPABASE_URL: "https://jjfnuqwjucqirmrgfjne.supabase.co",
  CRM_SUPABASE_ANON_KEY: "sb_publishable_MyVpSs485ZeYs31LtNo8RQ_5pjRTB79"
};

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    let result;
    switch (request.action || "") {
      case "submitAll": result = submitAll_(request); break;
      case "login": result = login_(request); break;
      case "listData": result = listData_(request); break;
      case "getDetail": result = getDetail_(request); break;
      case "updateStatus": result = updateStatus_(request); break;
      case "exportPdf": result = exportPdf_(request); break;
      case "deleteData": result = deleteData_(request); break;
      default: throw new Error("Action tidak dikenali.");
    }
    return json_({success:true, ...(result || {})});
  } catch (error) {
    return json_({success:false, message:error.message || String(error)});
  }
}

function submitAll_(request) {
  const data = request.data || {};
  const files = request.files || [];

  data["Nomor Handphone Pemegang Polis"] =
    normalizePhone_(data["Nomor Handphone Pemegang Polis"]);

  data["Nomor Handphone Tertanggung"] =
    normalizePhone_(data["Nomor Handphone Tertanggung"]);
  if (!data["Nama Tertanggung"]) throw new Error("Nama Tertanggung wajib diisi.");
  if (!data["Nomor Handphone Tertanggung"]) throw new Error("Nomor Handphone Tertanggung wajib diisi.");

  const sheet = getSheet_();
  const registrationNumber = createRegistrationNumber_();
  const fileData = uploadFiles_(registrationNumber, files);

  const row = {
    Timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
    "Nomor Registrasi": registrationNumber,
    ...data,
    ...fileData,
    "Folder Dokumen": getRegistrationFolder_(registrationNumber).getUrl(),
    Status: "Baru",
    "Sudah Dibaca": "Tidak",
    "Terakhir Dibaca": ""
  };

  ensureHeaders_(sheet, Object.keys(row));
  appendObject_(sheet, row);
  return {registrationNumber};
}

function login_(request) {
  if (String(request.username || "") !== CONFIG.ADMIN_USERNAME ||
      String(request.password || "") !== CONFIG.ADMIN_PASSWORD) {
    throw new Error("Username atau password salah.");
  }
  return {session:createSession_()};
}

function listData_(request) {
  validateAdminRequest_(request);
  return {rows:readRows_(getSheet_()).reverse()};
}

function getDetail_(request) {
  validateAdminRequest_(request);
  const sheet = getSheet_();
  const row = findByRegistration_(sheet, request.registrationNumber);
  updateFieldsByRegistration_(sheet, request.registrationNumber, {
    "Sudah Dibaca":"Ya",
    "Terakhir Dibaca":Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
  });
  row["Sudah Dibaca"] = "Ya";
  return {row};
}

function updateStatus_(request) {
  validateAdminRequest_(request);
  const allowed = ["Baru","Sedang Dicek","Dokumen Kurang","Sudah Lengkap","Selesai"];
  if (!allowed.includes(request.status)) throw new Error("Status tidak valid.");
  updateFieldsByRegistration_(getSheet_(), request.registrationNumber, {Status:request.status});
  return {};
}

function exportPdf_(request) {
  validateAdminRequest_(request);

  const row = findByRegistration_(getSheet_(), request.registrationNumber);
  const registrationNumber = request.registrationNumber;
  const documentName = "Laporan Kuisioner - " + registrationNumber;

  const doc = DocumentApp.create(documentName);
  const body = doc.getBody();

  setupPdfPage_(body);
  addPdfHeader_(body, row, registrationNumber);
  addPdfIdentitySections_(body, row);
  addPdfQuestionnaire_(body, row);
  addPdfDocuments_(body, row);
  addPdfClosing_(body);

  const footer = doc.addFooter();
  const footerParagraph = footer.appendParagraph(
    "Laporan Kuisioner Riwayat Penyakit • " +
    registrationNumber +
    " • Dicetak " +
    formatPdfDate_(new Date())
  );
  footerParagraph
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setFontSize(8)
    .setForegroundColor("#667085");

  doc.saveAndClose();

  const sourceFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = sourceFile
    .getAs(MimeType.PDF)
    .setName("Laporan_" + registrationNumber + ".pdf");

  const pdfFolder = getOrCreateSubfolder_(getRootFolder_(), "Laporan PDF");

  const existingFiles = pdfFolder.getFilesByName(pdfBlob.getName());
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  const pdfFile = pdfFolder.createFile(pdfBlob);
  sourceFile.setTrashed(true);

  return {
    fileName: pdfBlob.getName(),
    mimeType: "application/pdf",
    base64: Utilities.base64Encode(pdfBlob.getBytes())
  };
}

function setupPdfPage_(body) {
  body
    .setPageWidth(595.28)
    .setPageHeight(841.89)
    .setMarginTop(42)
    .setMarginBottom(42)
    .setMarginLeft(42)
    .setMarginRight(42);
}

function addPdfHeader_(body, row, registrationNumber) {
  const title = body.appendParagraph("LAPORAN KUISIONER");
  title
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setSpacingAfter(0);

  title.editAsText()
    .setBold(true)
    .setFontSize(20)
    .setForegroundColor("#173F9E");

  const subtitle = body.appendParagraph("RIWAYAT PENYAKIT");
  subtitle
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setSpacingBefore(0)
    .setSpacingAfter(18);

  subtitle.editAsText()
    .setBold(true)
    .setFontSize(12)
    .setForegroundColor("#475467");

  const summaryTable = body.appendTable([
    ["NOMOR REGISTRASI", registrationNumber],
    ["TANGGAL PENGAJUAN", row.Timestamp || "-"],
    ["STATUS", row.Status || "Baru"],
    ["NAMA TERTANGGUNG", row["Nama Tertanggung"] || "-"]
  ]);

  stylePdfSummaryTable_(summaryTable, row.Status || "Baru");
  body.appendParagraph("").setSpacingAfter(4);
}

function stylePdfSummaryTable_(table, status) {
  table.setBorderColor("#D0D5DD");
  table.setBorderWidth(1);

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const tableRow = table.getRow(rowIndex);
    const labelCell = tableRow.getCell(0);
    const valueCell = tableRow.getCell(1);

    stylePdfCell_(labelCell, "#F2F4F7", 9, true, "#475467");
    stylePdfCell_(valueCell, "#FFFFFF", 10, true, "#101828");

    if (rowIndex === 2) {
      valueCell.setBackgroundColor(getStatusBackground_(status));
      valueCell.editAsText().setForegroundColor(getStatusTextColor_(status));
    }
  }

  table.setColumnWidth(0, 155);
  table.setColumnWidth(1, 355);
}

function addPdfIdentitySections_(body, row) {
  addPdfSectionTitle_(body, "DATA PEMEGANG POLIS");

  addPdfKeyValueTable_(body, [
    ["Nama Pemegang Polis", row["Nama Pemegang Polis"]],
    ["Nomor Handphone", row["Nomor Handphone Pemegang Polis"]],
    ["Email", row.Email],
    ["Nama Pembayar Premi", row["Nama Pembayar Premi"]],
    ["Hubungan dengan Tertanggung", row["Hubungan Calon Tertanggung dengan Calon Pembayar Premi"]],
    ["Penghasilan Kotor Tahunan", row["Penghasilan Kotor Tahunan"]],
    ["Sumber Penghasilan", row["Sumber Penghasilan"]],
    ["Nama Perusahaan", row["Nama Perusahaan (Tempat Kerja)"]],
    ["Jenis Usaha", row["Jenis Usaha"]],
    ["Bidang Usaha", row["Bidang Usaha"]],
    ["Jabatan", row.Jabatan],
    ["Uraian Pekerjaan", row["Uraian Pekerjaan (Bagian)"]]
  ]);

  addPdfSectionTitle_(body, "DATA TERTANGGUNG");

  addPdfKeyValueTable_(body, [
    ["Nama Tertanggung", row["Nama Tertanggung"]],
    ["Nomor Handphone", row["Nomor Handphone Tertanggung"]],
    ["Jenis Kelamin", row["Jenis Kelamin Tertanggung"]],
    ["Tanggal Lahir", row["Tanggal Lahir Tertanggung"]],
    ["Nama Ibu Kandung", row["Nama Ibu Kandung Tertanggung"]],
    ["Tinggi Badan", appendUnit_(row["Tinggi Badan Tertanggung"], "cm")],
    ["Berat Badan", appendUnit_(row["Berat Badan Tertanggung"], "kg")]
  ]);
}

function addPdfQuestionnaire_(body, row) {
  body.appendPageBreak();
  addPdfSectionTitle_(body, "HASIL KUISIONER");

  const excludedKeys = getPdfExcludedKeys_();
  const documentKeys = getPdfDocumentEntries_(row).map(function(item) {
    return item.key;
  });

  const answers = Object.keys(row)
    .filter(function(key) {
      const value = String(row[key] || "").trim();
      return value &&
        excludedKeys.indexOf(key) < 0 &&
        documentKeys.indexOf(key) < 0 &&
        !isPdfDocumentField_(key, value);
    })
    .map(function(key) {
      return [key, String(row[key])];
    });

  if (!answers.length) {
    addPdfEmptyNotice_(body, "Tidak ada jawaban kuisioner.");
    return;
  }

  const table = body.appendTable();
  table.setBorderColor("#D0D5DD");
  table.setBorderWidth(1);

  const header = table.appendTableRow();
  const headerQuestion = header.appendTableCell("PERTANYAAN / KETERANGAN");
  const headerAnswer = header.appendTableCell("JAWABAN");

  stylePdfCell_(headerQuestion, "#173F9E", 9, true, "#FFFFFF");
  stylePdfCell_(headerAnswer, "#173F9E", 9, true, "#FFFFFF");

  answers.forEach(function(entry, index) {
    const question = getPdfQuestionLabel_(entry[0]);
    const answer = entry[1];
    const tableRow = table.appendTableRow();
    const questionCell = tableRow.appendTableCell(question);
    const answerCell = tableRow.appendTableCell(answer);

    const baseBackground = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
    stylePdfCell_(questionCell, baseBackground, 8.5, false, "#344054");
    stylePdfCell_(
      answerCell,
      getAnswerBackground_(answer, baseBackground),
      8.5,
      isImportantAnswer_(answer),
      getAnswerTextColor_(answer)
    );
  });

  table.setColumnWidth(0, 360);
  table.setColumnWidth(1, 150);
}

function addPdfDocuments_(body, row) {
  const documents = getPdfDocumentEntries_(row);
  if (!documents.length) return;

  body.appendPageBreak();
  addPdfSectionTitle_(body, "DOKUMEN YANG DIUNGGAH");

  const table = body.appendTable();
  table.setBorderColor("#D0D5DD");
  table.setBorderWidth(1);

  const header = table.appendTableRow();
  stylePdfCell_(header.appendTableCell("DOKUMEN"), "#173F9E", 9, true, "#FFFFFF");
  stylePdfCell_(header.appendTableCell("TAUTAN GOOGLE DRIVE"), "#173F9E", 9, true, "#FFFFFF");

  documents.forEach(function(document, index) {
    const tableRow = table.appendTableRow();
    const baseBackground = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
    const labelCell = tableRow.appendTableCell(document.key);
    const urlCell = tableRow.appendTableCell("");

    stylePdfCell_(labelCell, baseBackground, 8.5, true, "#344054");
    stylePdfCell_(urlCell, baseBackground, 8.5, false, "#2457D6");

    const paragraph = urlCell.getChild(0).asParagraph();
    const linkText = paragraph.appendText("Buka dokumen");
    linkText
      .setLinkUrl(document.url)
      .setForegroundColor("#2457D6")
      .setUnderline(true);
  });

  table.setColumnWidth(0, 245);
  table.setColumnWidth(1, 265);
}

function addPdfClosing_(body) {
  body.appendParagraph("").setSpacingAfter(8);

  const noteTable = body.appendTable([[
    "Laporan ini dibuat otomatis berdasarkan data yang dikirim melalui Form Kuisioner Riwayat Penyakit. " +
    "Harap lakukan verifikasi terhadap jawaban dan dokumen sebelum mengambil keputusan."
  ]]);

  noteTable.setBorderColor("#B2CCFF");
  noteTable.setBorderWidth(1);

  const cell = noteTable.getCell(0, 0);
  stylePdfCell_(cell, "#EFF4FF", 8.5, false, "#3538CD");
}

function addPdfSectionTitle_(body, title) {
  const table = body.appendTable([[title]]);
  table.setBorderWidth(0);

  const cell = table.getCell(0, 0);
  stylePdfCell_(cell, "#173F9E", 10, true, "#FFFFFF");

  body.appendParagraph("").setSpacingAfter(2);
}

function addPdfKeyValueTable_(body, entries) {
  const filtered = entries.filter(function(entry) {
    return String(entry[1] || "").trim();
  });

  if (!filtered.length) {
    addPdfEmptyNotice_(body, "Data tidak tersedia.");
    return;
  }

  const table = body.appendTable();
  table.setBorderColor("#D0D5DD");
  table.setBorderWidth(1);

  filtered.forEach(function(entry, index) {
    const tableRow = table.appendTableRow();
    const labelCell = tableRow.appendTableCell(entry[0]);
    const valueCell = tableRow.appendTableCell(String(entry[1]));
    const background = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";

    stylePdfCell_(labelCell, "#F2F4F7", 8.5, true, "#475467");
    stylePdfCell_(valueCell, background, 8.5, false, "#101828");
  });

  table.setColumnWidth(0, 200);
  table.setColumnWidth(1, 310);
  body.appendParagraph("").setSpacingAfter(6);
}

function stylePdfCell_(cell, background, fontSize, bold, textColor) {
  cell
    .setBackgroundColor(background)
    .setPaddingTop(7)
    .setPaddingBottom(7)
    .setPaddingLeft(8)
    .setPaddingRight(8);

  const text = cell.editAsText();
  text
    .setFontSize(fontSize)
    .setBold(bold)
    .setForegroundColor(textColor);
}

function addPdfEmptyNotice_(body, message) {
  const table = body.appendTable([[message]]);
  table.setBorderColor("#EAECF0");
  table.setBorderWidth(1);
  stylePdfCell_(table.getCell(0, 0), "#F9FAFB", 9, false, "#667085");
  body.appendParagraph("").setSpacingAfter(6);
}

function getPdfExcludedKeys_() {
  return [
    "Timestamp",
    "Nomor Registrasi",
    "Email",
    "Nama Pemegang Polis",
    "Nomor Handphone Pemegang Polis",
    "Nama Tertanggung",
    "Nomor Handphone Tertanggung",
    "Jenis Kelamin Tertanggung",
    "Tanggal Lahir Tertanggung",
    "Nama Ibu Kandung Tertanggung",
    "Tinggi Badan Tertanggung",
    "Berat Badan Tertanggung",
    "Nama Pembayar Premi",
    "Hubungan Calon Tertanggung dengan Calon Pembayar Premi",
    "Penghasilan Kotor Tahunan",
    "Sumber Penghasilan",
    "Nama Perusahaan (Tempat Kerja)",
    "Jenis Usaha",
    "Bidang Usaha",
    "Jabatan",
    "Uraian Pekerjaan (Bagian)",
    "Folder Dokumen",
    "Status",
    "Sudah Dibaca",
    "Terakhir Dibaca"
  ];
}

function getPdfDocumentEntries_(row) {
  const output = [];

  Object.keys(row).forEach(function(key) {
    const value = String(row[key] || "").trim();
    if (!value || !isPdfDocumentField_(key, value)) return;

    extractPdfUrls_(value).forEach(function(url) {
      output.push({key:key, url:url});
    });
  });

  return output;
}

function isPdfDocumentField_(key, value) {
  const label = String(key || "").toLowerCase();
  const text = String(value || "").trim();

  return /foto|dokumen|ktp|kartu keluarga|buku bank|lampiran|folder/i.test(label) ||
    /^https?:\/\/(drive\.google\.com|docs\.google\.com)/i.test(text);
}

function extractPdfUrls_(value) {
  return String(value || "")
    .split(/\s+/)
    .map(function(item) {
      return item.trim();
    })
    .filter(function(item) {
      return /^https?:\/\//i.test(item);
    });
}

function isImportantAnswer_(answer) {
  const normalized = String(answer || "").trim().toUpperCase();
  return normalized === "YA" || normalized === "TIDAK";
}

function getAnswerBackground_(answer, fallback) {
  const normalized = String(answer || "").trim().toUpperCase();
  if (normalized === "YA") return "#FFF1F0";
  if (normalized === "TIDAK") return "#ECFDF3";
  return fallback;
}

function getAnswerTextColor_(answer) {
  const normalized = String(answer || "").trim().toUpperCase();
  if (normalized === "YA") return "#B42318";
  if (normalized === "TIDAK") return "#067647";
  return "#101828";
}

function getStatusBackground_(status) {
  const map = {
    "Baru":"#EAF2FF",
    "Sedang Dicek":"#FFF7E8",
    "Dokumen Kurang":"#FFF1F0",
    "Sudah Lengkap":"#ECFDF3",
    "Selesai":"#EEF2F6"
  };
  return map[status] || "#EAF2FF";
}

function getStatusTextColor_(status) {
  const map = {
    "Baru":"#1D4ED8",
    "Sedang Dicek":"#B54708",
    "Dokumen Kurang":"#B42318",
    "Sudah Lengkap":"#067647",
    "Selesai":"#344054"
  };
  return map[status] || "#1D4ED8";
}

function appendUnit_(value, unit) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.toLowerCase().indexOf(unit.toLowerCase()) >= 0
    ? text
    : text + " " + unit;
}

function formatPdfDate_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm"
  );
}

function uploadFiles_(registrationNumber, files) {
  const output = {};
  if (!files || !files.length) return output;
  const folder = getRegistrationFolder_(registrationNumber);

  files.forEach(function(file) {
    if (!file.base64) return;
    const safeName = sanitizeFileName_(file.fileName || "dokumen.jpg");
    const bytes = Utilities.base64Decode(file.base64);
    const blob = Utilities.newBlob(bytes, file.mimeType || "image/jpeg", safeName);
    const created = folder.createFile(blob);
    const label = String(file.fieldLabel || safeName);
    output[label] = created.getUrl();
  });
  return output;
}

function getRegistrationFolder_(registrationNumber) {
  return getOrCreateSubfolder_(getRootFolder_(), registrationNumber);
}
function getRootFolder_() {
  if (!CONFIG.DRIVE_FOLDER_ID || CONFIG.DRIVE_FOLDER_ID.indexOf("PASTE_") === 0)
    throw new Error("DRIVE_FOLDER_ID belum diisi.");
  return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
}
function getSheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf("PASTE_") === 0)
    throw new Error("SPREADSHEET_ID belum diisi.");
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
}
function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const lastColumn = Math.max(sheet.getLastColumn(),1);
  const existing = sheet.getRange(1,1,1,lastColumn).getDisplayValues()[0].filter(String);
  const missing = headers.filter(function(h){return existing.indexOf(h) < 0;});
  if (missing.length) sheet.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
}
function appendObject_(sheet, object) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const rowNumber = sheet.getLastRow() + 1;

  const values = headers.map(function(header) {
    let value = object[header];

    if (value === undefined || value === null) {
      value = "";
    }

    return String(value);
  });

  const range = sheet.getRange(rowNumber, 1, 1, values.length);

  // Simpan sebagai teks agar angka 0 di depan nomor handphone tidak hilang.
  range.setNumberFormat("@");
  range.setValues([values]);
}
function readRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift();
  return values.map(function(row) {
    const object = {};
    headers.forEach(function(h,i){object[h] = row[i] || "";});
    return object;
  });
}
function findByRegistration_(sheet, registrationNumber) {
  const row = readRows_(sheet).find(function(item){
    return item["Nomor Registrasi"] === registrationNumber;
  });
  if (!row) throw new Error("Data tidak ditemukan.");
  return row;
}
function updateFieldsByRegistration_(sheet, registrationNumber, fields) {
  ensureHeaders_(sheet, Object.keys(fields));
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const regColumn = headers.indexOf("Nomor Registrasi");
  const rowIndex = values.findIndex(function(row,index){
    return index > 0 && String(row[regColumn]) === String(registrationNumber);
  });
  if (rowIndex < 0) throw new Error("Data tidak ditemukan.");
  Object.keys(fields).forEach(function(key) {
    const column = headers.indexOf(key);
    if (column >= 0) sheet.getRange(rowIndex+1,column+1).setValue(fields[key]);
  });
}
function getOrCreateSubfolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
function createRegistrationNumber_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  return "RP-" + date + "-" + Utilities.getUuid().slice(0,6).toUpperCase();
}
function sanitizeFileName_(name) {
  return String(name).replace(/[\\/:*?"<>|]+/g,"_").slice(0,150);
}
function createSession_() {
  const payload = {
    exp:Date.now() + Number(CONFIG.SESSION_HOURS || 12) * 3600000,
    nonce:Utilities.getUuid()
  };
  const raw = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(raw, CONFIG.SESSION_SECRET)
  );
  return raw + "." + signature;
}
function validateAdminRequest_(request) {
  if (request && request.accessToken) {
    validateCrmAdminToken_(String(request.accessToken));
    return;
  }
  // Tetap mendukung admin lama selama halaman admin lama belum dihapus.
  validateSession_(request && request.session);
}

function validateCrmAdminToken_(accessToken) {
  if (!accessToken) throw new Error("Sesi CRM tidak ditemukan.");

  const baseUrl = String(CONFIG.CRM_SUPABASE_URL || "").replace(/\/$/, "");
  const headers = {
    apikey: CONFIG.CRM_SUPABASE_ANON_KEY,
    Authorization: "Bearer " + accessToken
  };

  const userResponse = UrlFetchApp.fetch(baseUrl + "/auth/v1/user", {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (userResponse.getResponseCode() !== 200) {
    throw new Error("Sesi CRM sudah berakhir. Silakan login kembali.");
  }

  const user = JSON.parse(userResponse.getContentText() || "{}");
  if (!user.id) throw new Error("Akun CRM tidak valid.");

  const profileUrl = baseUrl + "/rest/v1/admin_profiles" +
    "?user_id=eq." + encodeURIComponent(user.id) +
    "&select=role,is_active&limit=1";

  const profileResponse = UrlFetchApp.fetch(profileUrl, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (profileResponse.getResponseCode() !== 200) {
    throw new Error("Profil admin CRM tidak dapat diverifikasi.");
  }

  const profiles = JSON.parse(profileResponse.getContentText() || "[]");
  const profile = profiles && profiles[0];
  if (!profile || profile.is_active === false) {
    throw new Error("Akun ini bukan admin CRM aktif.");
  }
}

function validateSession_(token) {
  if (!token || token.indexOf(".") < 0) throw new Error("Sesi login tidak valid.");
  const parts = token.split(".");
  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], CONFIG.SESSION_SECRET)
  );
  if (parts[1] !== expected) throw new Error("Sesi login tidak valid.");
  const payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
  );
  if (Date.now() > payload.exp) throw new Error("Sesi login sudah berakhir.");
}
function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizePhone_(phone) {
  phone = String(phone || "").trim();

  if (!phone) {
    return "";
  }

  phone = phone.replace(/[\s\-()]/g, "");

  if (phone.indexOf("+62") === 0) {
    phone = "0" + phone.substring(3);
  } else if (phone.indexOf("62") === 0) {
    phone = "0" + phone.substring(2);
  }

  if (phone.indexOf("0") !== 0) {
    phone = "0" + phone;
  }

  return phone;
}


function getPdfQuestionLabel_(label) {
  const text = String(label || "").trim();

  // Data baru sudah menyimpan nomor pertanyaan pada label.
  if (/^\d+[a-z]?(?:\.\d+)?\.?\s/i.test(text)) {
    return text;
  }

  const questionNumbers = {
  "Tinggi Badan Tertanggung": "1.",
  "Berat Badan Tertanggung": "2.",
  "Apakah Anda perokok? Jika Ya mohon jelaskan berapa batang per hari?": "3.",
  "Penjelasan - Apakah Anda perokok? Jika Ya mohon jelaskan berapa batang per hari?": "3.",
  "Apakah Anda saat ini dalam keadaan tidak sehat? Jika Ya, harap dijelaskan": "4.",
  "Penjelasan - Apakah Anda saat ini dalam keadaan tidak sehat? Jika Ya, harap dijelaskan": "4.",
  "Apakah Anda memiliki sesuatu cacat fisik atau mental? Jika Ya, harap dijelaskan": "5.",
  "Penjelasan - Apakah Anda memiliki sesuatu cacat fisik atau mental? Jika Ya, harap dijelaskan": "5.",
  "Apakah Anda pernah/sedang menggunakan obat-obatan, obat bius, narkotik, minuman keras atau obat terlarang? Jika Ya, harap dijelaskan": "6.",
  "Penjelasan - Apakah Anda pernah/sedang menggunakan obat-obatan, obat bius, narkotik, minuman keras atau obat terlarang? Jika Ya, harap dijelaskan": "6.",
  "Apakah Anda pernah mengalami kecelakaan dan menderita cedera/luka berat? Jika Ya, harap dijelaskan": "7.",
  "Penjelasan - Apakah Anda pernah mengalami kecelakaan dan menderita cedera/luka berat? Jika Ya, harap dijelaskan": "7.",
  "Kelainan syaraf kerangka dan otot. Kelumpuhan, ayan/kejang, pingsan, sering pusing (Vertigo), kesemutan, nyeri sendi, rematik/encok, demam rematik, kelemahan alat gerak, stres, depresi, gangguan jiwa? Jika Ya, harap dijelaskan": "8a.",
  "Penjelasan - Kelainan syaraf kerangka dan otot. Kelumpuhan, ayan/kejang, pingsan, sering pusing (Vertigo), kesemutan, nyeri sendi, rematik/encok, demam rematik, kelemahan alat gerak, stres, depresi, gangguan jiwa? Jika Ya, harap dijelaskan": "8a.",
  "Kelainan atau gangguan fungsi pada mata, telinga, hidung, tenggorokan? Jika Ya, harap dijelaskan": "8b.",
  "Penjelasan - Kelainan atau gangguan fungsi pada mata, telinga, hidung, tenggorokan? Jika Ya, harap dijelaskan": "8b.",
  "Kelainan saluran pernafasan. Asthma, bronchitis, TBC, paru, batuk kronis, batuk darah? Jika Ya, harap dijelaskan": "8c.",
  "Penjelasan - Kelainan saluran pernafasan. Asthma, bronchitis, TBC, paru, batuk kronis, batuk darah? Jika Ya, harap dijelaskan": "8c.",
  "Kelainan jantung dan pembuluh darah. Sesak napas, berdebar-debar, sakit dada, serangan jantung, sering sakit kepala, tekanan darah tinggi, stroke, varices? Jika Ya, harap dijelaskan": "8d.",
  "Penjelasan - Kelainan jantung dan pembuluh darah. Sesak napas, berdebar-debar, sakit dada, serangan jantung, sering sakit kepala, tekanan darah tinggi, stroke, varices? Jika Ya, harap dijelaskan": "8d.",
  "Kelainan saluran pencernaan dan hati. Sakit ulu hati (maag), sakit kuning, muntah darah, ambeien (wasir), hernia, sering sakit perut (diare), muntah-muntah, hepatitis (tipe ...), batu atau infeksi saluran empedu?": "8e.",
  "Penjelasan - Kelainan saluran pencernaan dan hati. Sakit ulu hati (maag), sakit kuning, muntah darah, ambeien (wasir), hernia, sering sakit perut (diare), muntah-muntah, hepatitis (tipe ...), batu atau infeksi saluran empedu?": "8e.",
  "Kelainan ginjal dan saluran kemih. Sakit pinggang, kencing batu/batu ginjal, infeksi ginjal, kencing darah, kencing nanah, sakit prostat? Jika Ya, harap dijelaskan": "8f.",
  "Penjelasan - Kelainan ginjal dan saluran kemih. Sakit pinggang, kencing batu/batu ginjal, infeksi ginjal, kencing darah, kencing nanah, sakit prostat? Jika Ya, harap dijelaskan": "8f.",
  "Tumor, kanker, atau suatu benjolan yang tidak hilang? Jika Ya, harap dijelaskan": "8g.",
  "Penjelasan - Tumor, kanker, atau suatu benjolan yang tidak hilang? Jika Ya, harap dijelaskan": "8g.",
  "Kelainan metabolisme. Kencing manis, kelenjar gondok? Jika Ya, harap dijelaskan": "8h.",
  "Penjelasan - Kelainan metabolisme. Kencing manis, kelenjar gondok? Jika Ya, harap dijelaskan": "8h.",
  "Penyakit tropis/infeksi. Malaria, demam berdarah, tipus? Jika Ya, harap dijelaskan": "8i.",
  "Penjelasan - Penyakit tropis/infeksi. Malaria, demam berdarah, tipus? Jika Ya, harap dijelaskan": "8i.",
  "Sering demam yang berlangsung lama, sering berkeringat dingin, kehilangan berat badan yang drastis, adanya pembesaran kelenjar di leher, ketiak dan lipat paha? Jika Ya, harap dijelaskan": "8j.",
  "Penjelasan - Sering demam yang berlangsung lama, sering berkeringat dingin, kehilangan berat badan yang drastis, adanya pembesaran kelenjar di leher, ketiak dan lipat paha? Jika Ya, harap dijelaskan": "8j.",
  "Menerima transfusi darah? Jika Ya, harap dijelaskan": "8j.1.",
  "Penjelasan - Menerima transfusi darah? Jika Ya, harap dijelaskan": "8j.1.",
  "Ditolak sebagai donor darah? Jika Ya, harap dijelaskan": "8j.2.",
  "Penjelasan - Ditolak sebagai donor darah? Jika Ya, harap dijelaskan": "8j.2.",
  "Pernah tes darah untuk AIDS? Jika Ya, harap dijelaskan": "8j.3.",
  "Penjelasan - Pernah tes darah untuk AIDS? Jika Ya, harap dijelaskan": "8j.3.",
  "Sedang dalam perawatan Dokter sehubungan dengan AIDS? Jika Ya, harap dijelaskan": "8j.4.",
  "Penjelasan - Sedang dalam perawatan Dokter sehubungan dengan AIDS? Jika Ya, harap dijelaskan": "8j.4.",
  "Kelainan darah seperti anemia, leukemia? Jika Ya, harap dijelaskan": "8k.",
  "Penjelasan - Kelainan darah seperti anemia, leukemia? Jika Ya, harap dijelaskan": "8k.",
  "Kelainan kulit dan tulang. Gangguan tulang belakang, patah tulang, polio, amputasi, kelainan kulit, kusta? Jika Ya, harap dijelaskan": "8l.",
  "Penjelasan - Kelainan kulit dan tulang. Gangguan tulang belakang, patah tulang, polio, amputasi, kelainan kulit, kusta? Jika Ya, harap dijelaskan": "8l.",
  "Penyakit lainnya yang tidak disebutkan di atas? Jika Ya, harap dijelaskan": "8m.",
  "Penjelasan - Penyakit lainnya yang tidak disebutkan di atas? Jika Ya, harap dijelaskan": "8m.",
  "Menderita sakit, menjalani rawat inap, operasi, biopsi, endoskopi, radiasi? Jika Ya, harap dijelaskan": "9a.",
  "Penjelasan - Menderita sakit, menjalani rawat inap, operasi, biopsi, endoskopi, radiasi? Jika Ya, harap dijelaskan": "9a.",
  "ECG, USG, CT Scan, tes darah misalnya kolesterol, gula darah, AIDS, hepatitis termasuk hepatitis B, C, anemia dll? Jika Ya, harap dijelaskan": "9b.",
  "Penjelasan - ECG, USG, CT Scan, tes darah misalnya kolesterol, gula darah, AIDS, hepatitis termasuk hepatitis B, C, anemia dll? Jika Ya, harap dijelaskan": "9b.",
  "Menjalani pemeriksaan ke dokter umum/spesialis? Jika Ya, harap dijelaskan": "9c.",
  "Penjelasan - Menjalani pemeriksaan ke dokter umum/spesialis? Jika Ya, harap dijelaskan": "9c.",
  "Mengalami keracunan, kecelakaan atau coba bunuh diri? Jika Ya, harap dijelaskan": "9d.",
  "Penjelasan - Mengalami keracunan, kecelakaan atau coba bunuh diri? Jika Ya, harap dijelaskan": "9d.",
  "Apakah Anda sedang hamil? (Bila Ya, lengkapi usia kehamilan dan haid terakhir dd/mm/yy)": "10a.",
  "Penjelasan - Apakah Anda sedang hamil? (Bila Ya, lengkapi usia kehamilan dan haid terakhir dd/mm/yy)": "10a.",
  "Ada gangguan haid, pernah keguguran, kelainan pada saat bersalin? Jika Ya, harap dijelaskan": "10b.",
  "Penjelasan - Ada gangguan haid, pernah keguguran, kelainan pada saat bersalin? Jika Ya, harap dijelaskan": "10b.",
  "Pernah diberitahukan atau sedang menderita kelainan janin di dalam kandungan/rahim/indung telur atau organ reproduksi, komplikasi kehamilan, payudara? Jika Ya, harap dijelaskan": "10c.",
  "Penjelasan - Pernah diberitahukan atau sedang menderita kelainan janin di dalam kandungan/rahim/indung telur atau organ reproduksi, komplikasi kehamilan, payudara? Jika Ya, harap dijelaskan": "10c.",
  "Pernah atau disarankan untuk periksa papsmear, mammografi atau pemeriksaan kandungan lainnya? Jika Ya, harap dijelaskan": "10d.",
  "Penjelasan - Pernah atau disarankan untuk periksa papsmear, mammografi atau pemeriksaan kandungan lainnya? Jika Ya, harap dijelaskan": "10d.",
  "Apakah ada sanak keluarga (ayah, ibu, kakak, adik atau anak) yang menderita TBC paru, jantung, asthma, kencing manis, tekanan darah tinggi, ayan, kanker, AIDS atau penyakit lainnya? Jika Ya, harap dijelaskan": "11.",
  "Penjelasan - Apakah ada sanak keluarga (ayah, ibu, kakak, adik atau anak) yang menderita TBC paru, jantung, asthma, kencing manis, tekanan darah tinggi, ayan, kanker, AIDS atau penyakit lainnya? Jika Ya, harap dijelaskan": "11.",
  "Apakah Calon dilahirkan prematur dengan berat badan lahir dalam keadaan tidak normal? Jika Ya, harap dijelaskan": "12a.",
  "Penjelasan - Apakah Calon dilahirkan prematur dengan berat badan lahir dalam keadaan tidak normal? Jika Ya, harap dijelaskan": "12a.",
  "Apakah Calon dilahirkan secara tidak normal, menggunakan alat bantu? Jika Ya, harap dijelaskan": "12b.",
  "Penjelasan - Apakah Calon dilahirkan secara tidak normal, menggunakan alat bantu? Jika Ya, harap dijelaskan": "12b.",
  "Apakah Calon waktu dilahirkan menderita penyakit kuning? Jika Ya, harap dijelaskan": "12c.",
  "Penjelasan - Apakah Calon waktu dilahirkan menderita penyakit kuning? Jika Ya, harap dijelaskan": "12c.",
  "Apakah Calon bila menangis sering menjadi biru dan bila terlalu lelah akan menderita sesak napas? Jika Ya, harap dijelaskan": "12d.",
  "Penjelasan - Apakah Calon bila menangis sering menjadi biru dan bila terlalu lelah akan menderita sesak napas? Jika Ya, harap dijelaskan": "12d.",
  "Apakah Calon pernah mendapat imunisasi?": "12e.",
  "Imunisasi yang Sudah Didapatkan": "12e.",
  "Foto Lengkap Buku Imunisasi": "12e.",
  "Nama Pembayar Premi": "13.",
  "Hubungan Calon Tertanggung dengan Calon Pembayar Premi": "14.",
  "Penjelasan Hubungan Calon Tertanggung dengan Calon Pembayar Premi": "14.",
  "Penghasilan Kotor Tahunan": "15.",
  "Sumber Penghasilan": "16.",
  "Sumber Penghasilan Lainnya": "16.",
  "Nama Perusahaan (Tempat Kerja)": "17.",
  "Jenis Usaha": "18.",
  "Bidang Usaha": "19.",
  "Jabatan": "20.",
  "Uraian Pekerjaan (Bagian)": "21.",
  "Foto Kartu Keluarga Pemegang Polis": "22.",
  "Foto KTP Pemegang Polis (Tidak boleh dokumen yang scan, harus foto dari Handphone langsung)": "23.",
  "Foto copy buku Bank (Bagian Nomor rekening)": "24.",
  "Foto KTP Tertanggung (Tidak boleh dokumen yang scan, harus foto dari Handphone langsung)": "25.",
  "Foto Kartu Keluarga Tertanggung": "26.",
  "Foto copy buku Bank Tertanggung (Bagian Nomor rekening)": "27."
};
  const number = questionNumbers[text];

  return number ? number + " " + text : text;
}

function deleteData_(request) {
  validateAdminRequest_(request);

  const registrationNumber = String(
    request.registrationNumber || ""
  ).trim();

  if (!registrationNumber) {
    throw new Error("Nomor registrasi tidak valid.");
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error("Data tidak ditemukan.");
  }

  const headers = values[0];
  const regCol = headers.indexOf("Nomor Registrasi");

  if (regCol < 0) {
    throw new Error("Kolom Nomor Registrasi tidak ditemukan.");
  }

  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][regCol]).trim() === registrationNumber) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex < 0) {
    throw new Error("Data tidak ditemukan.");
  }

  const rootFolder = getRootFolder_();

  const folders = rootFolder.getFoldersByName(registrationNumber);
  while (folders.hasNext()) {
    folders.next().setTrashed(true);
  }

  const pdfFolders = rootFolder.getFoldersByName("Laporan PDF");
  while (pdfFolders.hasNext()) {
    const pdfFolder = pdfFolders.next();
    const files = pdfFolder.getFilesByName(
      "Laporan_" + registrationNumber + ".pdf"
    );

    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
  }

  sheet.deleteRow(rowIndex);

  return {
    deleted: true,
    registrationNumber: registrationNumber
  };
}


/**
 * Jalankan SATU KALI dari editor Apps Script setelah mengganti Code.gs dan
 * appsscript.json. Fungsi ini memunculkan permintaan izin external request
 * yang dibutuhkan untuk memverifikasi sesi admin CRM ke Supabase.
 */
function authorizeCrmIntegration() {
  const baseUrl = String(CONFIG.CRM_SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl || !CONFIG.CRM_SUPABASE_ANON_KEY) {
    throw new Error("Konfigurasi Supabase CRM belum lengkap.");
  }

  const response = UrlFetchApp.fetch(baseUrl + "/auth/v1/health", {
    method: "get",
    headers: { apikey: CONFIG.CRM_SUPABASE_ANON_KEY },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 500) {
    throw new Error("Koneksi Supabase gagal. HTTP " + code);
  }

  Logger.log("Izin CRM berhasil. HTTP " + code);
  return "Izin CRM berhasil. Silakan deploy versi baru.";
}
