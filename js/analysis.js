let analysisClientId = "";

const MODULE_SERVICE_MAP = {
  "dana-pendidikan": "education",
  "review-polis": "review",
  "asuransi-jiwa": "life",
  "penyakit-kritis": "critical",
  "asuransi-kesehatan": "health",
  "dana-darurat": "emergency",
  "dana-pensiun": "retirement",
  "financial-checkup": "review"
};

function latestSimulation(activities) {
  return (activities || []).find(item =>
    item?.metadata?.simulation_summary &&
    item?.metadata?.source === "website_personal"
  ) || null;
}

function renderSimulationSummary(summary) {
  const lines = String(summary || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return '<div class="empty">Tidak ada ringkasan simulasi.</div>';

  return lines.map(line => {
    const separator = line.indexOf(":");
    if (separator > 0 && separator < 45) {
      const label = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return `<div class="simulation-data-row"><span>${esc(label)}</span><strong>${esc(value || "-")}</strong></div>`;
    }
    return `<p class="simulation-data-text">${esc(line)}</p>`;
  }).join("");
}

function recommendModule(slug) {
  const moduleClass = MODULE_SERVICE_MAP[slug];
  document.querySelectorAll(".analysis-module").forEach(card => {
    card.classList.remove("recommended");
    card.querySelector(".module-recommendation")?.remove();
  });
  if (!moduleClass) return;
  const card = document.querySelector(`.analysis-module.${moduleClass}`);
  if (!card) return;
  card.classList.add("recommended");
  const badge = document.createElement("span");
  badge.className = "module-recommendation";
  badge.textContent = "Direkomendasikan";
  card.querySelector("div")?.appendChild(badge);
}


function selectModule(slug) {
  document.querySelectorAll(".analysis-module").forEach(card => {
    card.classList.remove("selected");
    card.querySelector(".module-selected")?.remove();
  });

  if (!slug) return;
  const card = document.querySelector(`.analysis-module[data-module="${CSS.escape(slug)}"]`);
  if (!card) return;

  card.classList.add("selected");
  const badge = document.createElement("span");
  badge.className = "module-selected";
  badge.textContent = "Dipilih";
  card.querySelector("div")?.appendChild(badge);
}

async function initAnalysis() {
  if (!(await protectPage())) return;

  const query = new URLSearchParams(location.search);
  analysisClientId = query.get("client_id") || "";
  const selectedModule = query.get("module") || "";
  const picker = document.getElementById("analysisClientPicker");

  try {
    const clients = await api.listClients();
    picker.innerHTML = '<option value="">Pilih client...</option>' +
      clients.map(c => `<option value="${esc(c.id)}">${esc(c.full_name)} · ${esc(c.client_code)}</option>`).join("");
    if (analysisClientId) picker.value = analysisClientId;
  } catch (error) {
    console.warn("Daftar client gagal dimuat:", error.message);
  }

  picker.addEventListener("change", () => {
    const id = picker.value;
    location.href = id ? `analysis.html?client_id=${encodeURIComponent(id)}` : "analysis.html";
  });

  document.querySelectorAll(".analysis-module").forEach(card => {
    card.addEventListener("click", event => {
      if (!analysisClientId) {
        event.preventDefault();
        picker.focus();
        alert("Pilih client terlebih dahulu.");
      }
    });
  });

  if (!analysisClientId) {
    document.getElementById("analysisEmptyState").hidden = false;
    document.getElementById("analysisWorkspace").hidden = true;
    if (window.lucide) lucide.createIcons();
    return;
  }

  try {
    const data = await api.clientDetail(analysisClientId);
    const client = data.client;
    const consultation = data.consultations?.[0] || null;
    activeConsultationId = consultation?.id || "";
    const simulation = latestSimulation(data.activities);
    renderLatestConsultationResult(latestConsultationResult(data.activities));

    document.getElementById("analysisEmptyState").hidden = true;
    document.getElementById("analysisWorkspace").hidden = false;
    document.getElementById("activeClientName").textContent = client.full_name;
    document.getElementById("activeClientContact").textContent =
      [client.whatsapp, client.email].filter(Boolean).join(" · ") || "Kontak belum tersedia";
    document.getElementById("activeClientCode").textContent = client.client_code || "-";
    document.getElementById("activeService").textContent =
      consultation?.service_name_snapshot || "Belum ada konsultasi";
    document.getElementById("activeStatus").textContent =
      consultation ? statusLabel(consultation.consultation_status) : "-";

    const summaryPanel = document.getElementById("simulationPanel");
    if (simulation) {
      summaryPanel.hidden = false;
      document.getElementById("simulationSource").textContent =
        `Website Personal · ${fmtDate(simulation.created_at)}`;
      document.getElementById("simulationSummary").innerHTML =
        renderSimulationSummary(simulation.metadata.simulation_summary);
      recommendModule(simulation.metadata.service_slug);
    } else {
      summaryPanel.hidden = false;
      document.getElementById("simulationSource").textContent = "Belum tersedia";
      document.getElementById("simulationSummary").innerHTML =
        '<div class="empty">Client ini belum memiliki hasil simulasi dari Website Personal. Pendaftaran biasa tetap tersimpan dengan normal.</div>';
      recommendModule(consultation?.services?.slug || "");
    }

    document.querySelectorAll(".analysis-module").forEach(card => {
      const module = card.dataset.module;
      card.href = `analysis.html?client_id=${encodeURIComponent(analysisClientId)}&module=${encodeURIComponent(module)}`;
    });

    // Modul rekomendasi dan modul yang dipilih adalah dua status berbeda.
    // Dengan ini, klik modul lain tidak lagi terlihat kembali ke UP Jiwa.
    selectModule(selectedModule);

    if (selectedModule) {
      document.querySelector(`.analysis-module[data-module="${CSS.escape(selectedModule)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    alert("Gagal memuat workspace analisis: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", initAnalysis);

const RESULT_TOPIC_BY_MODULE = {
  "dana-pendidikan": "Dana Pendidikan",
  "review-polis": "Review Polis",
  "up-jiwa": "UP Jiwa",
  "penyakit-kritis": "Penyakit Kritis",
  "kesehatan": "Kesehatan",
  "dana-darurat": "Dana Darurat",
  "dana-pensiun": "Dana Pensiun"
};

let activeConsultationId = "";

function isoToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function openResultModal() {
  if (!analysisClientId) return alert("Pilih client terlebih dahulu.");
  document.getElementById("consultationResultModal").hidden = false;
  document.body.style.overflow = "hidden";
  const selectedModule = new URLSearchParams(location.search).get("module");
  const selectedTopic = RESULT_TOPIC_BY_MODULE[selectedModule];
  if (selectedTopic) {
    const box = [...document.querySelectorAll('input[name="resultTopic"]')]
      .find(input => input.value === selectedTopic);
    if (box) box.checked = true;
  }
  if (window.lucide) lucide.createIcons();
}

function closeResultModal() {
  document.getElementById("consultationResultModal").hidden = true;
  document.body.style.overflow = "";
}

function latestConsultationResult(activities) {
  return (activities || []).find(item => item?.event_type === "consultation_result_uploaded") || null;
}

function renderLatestConsultationResult(result) {
  const card = document.getElementById("latestConsultationResult");
  if (!result) {
    card.hidden = true;
    return;
  }
  const meta = result.metadata || {};
  const topics = Array.isArray(meta.topics) ? meta.topics.join(", ") : "-";
  card.hidden = false;
  card.innerHTML = `
    <small>HASIL TERAKHIR TERSIMPAN</small>
    <h3>Konsultasi sudah masuk CRM</h3>
    <div class="crm-result-line"><span>Tanggal</span><strong>${esc(meta.consultation_date || "-")}</strong></div>
    <div class="crm-result-line"><span>Topik</span><strong>${esc(topics)}</strong></div>
    <div class="crm-result-line"><span>Follow-up</span><strong>${esc(meta.follow_up_date || "Belum ditentukan")}</strong></div>
    ${meta.recommendation ? `<div class="crm-result-text"><strong>Premi / Rekomendasi</strong><br>${esc(meta.recommendation)}</div>` : ""}
    ${meta.notes ? `<div class="crm-result-text"><strong>Catatan</strong><br>${esc(meta.notes)}</div>` : ""}
  `;
}

async function submitConsultationResult(event) {
  event.preventDefault();
  const topics = [...document.querySelectorAll('input[name="resultTopic"]:checked')].map(input => input.value);
  if (!topics.length) return alert("Pilih minimal satu topik yang dikerjakan.");

  const button = document.getElementById("saveConsultationResult");
  button.disabled = true;
  button.innerHTML = "Menyimpan...";

  try {
    const result = await api.saveConsultationResult({
      clientId: analysisClientId,
      consultationId: activeConsultationId,
      consultationDate: document.getElementById("resultConsultationDate").value,
      topics,
      recommendation: document.getElementById("resultRecommendation").value.trim(),
      notes: document.getElementById("resultNotes").value.trim(),
      followUpDate: document.getElementById("resultFollowUpDate").value || null
    });
    renderLatestConsultationResult(result);
    document.getElementById("activeStatus").textContent = "Konsultasi Selesai";
    closeResultModal();
    alert("Hasil konsultasi berhasil disimpan ke CRM.");
  } catch (error) {
    alert("Gagal menyimpan hasil konsultasi: " + error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<i data-lucide="cloud-upload"></i> Simpan Hasil Meeting';
    if (window.lucide) lucide.createIcons();
  }
}

function initConsultationResultControls() {
  const dateInput = document.getElementById("resultConsultationDate");
  if (dateInput && !dateInput.value) dateInput.value = isoToday();
  document.getElementById("openConsultationResult")?.addEventListener("click", openResultModal);
  document.querySelectorAll("[data-close-result-modal]").forEach(el => el.addEventListener("click", closeResultModal));
  document.getElementById("consultationResultForm")?.addEventListener("submit", submitConsultationResult);
}

document.addEventListener("DOMContentLoaded", initConsultationResultControls);
