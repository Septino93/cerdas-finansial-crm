let analysisClientId = "";
let selectedAnalysisModule = "";

const MODULE_LABEL_MAP = {
  "dana-pendidikan": "Dana Pendidikan",
  "review-polis": "Review Polis",
  "up-jiwa": "UP Jiwa",
  "penyakit-kritis": "Penyakit Kritis",
  "kesehatan": "Kesehatan",
  "dana-darurat": "Dana Darurat",
  "dana-pensiun": "Dana Pensiun"
};

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

function selectModule(module) {
  document.querySelectorAll(".analysis-module").forEach(card => {
    card.classList.remove("selected");
    card.removeAttribute("aria-current");
    card.querySelector(".module-selected")?.remove();
  });

  const panel = document.getElementById("selectedModulePanel");
  if (!module || !MODULE_LABEL_MAP[module]) {
    if (panel) panel.hidden = true;
    return;
  }

  const card = document.querySelector(`.analysis-module[data-module="${module}"]`);
  if (!card) return;

  card.classList.add("selected");
  card.setAttribute("aria-current", "page");

  const badge = document.createElement("span");
  badge.className = "module-selected";
  badge.textContent = "Dipilih";
  card.querySelector("div")?.appendChild(badge);

  if (panel) {
    panel.hidden = false;
    document.getElementById("selectedModuleName").textContent = MODULE_LABEL_MAP[module];
  }
}

async function initAnalysis() {
  if (!(await protectPage())) return;

  const params = new URLSearchParams(location.search);
  analysisClientId = params.get("client_id") || "";
  selectedAnalysisModule = params.get("module") || "";
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
    const simulation = latestSimulation(data.activities);

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

    // Rekomendasi hanya memberi penanda hijau. Modul yang diklik tetap menjadi pilihan aktif.
    selectModule(selectedAnalysisModule);

    document.querySelectorAll(".analysis-module").forEach(card => {
      const module = card.dataset.module;
      card.href = `analysis.html?client_id=${encodeURIComponent(analysisClientId)}&module=${encodeURIComponent(module)}`;
    });

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    alert("Gagal memuat workspace analisis: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", initAnalysis);
