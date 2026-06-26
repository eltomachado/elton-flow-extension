const CHAR_DELAY_MS = 50;

// ─────────────────────────────────────────────
// Update banner
// ─────────────────────────────────────────────
const LATEST_VERSION = "1.2.1"; // ← bump this each release

const promptsEl        = document.getElementById("prompts");
const waitMinEl        = document.getElementById("waitMin");
const waitMaxEl        = document.getElementById("waitMax");
const statusEl         = document.getElementById("status");
const appEl            = document.getElementById("app");
const versionTagEl     = document.getElementById("versionTag");
const txtUploadEl      = document.getElementById("txtUpload");
const runBtn           = document.getElementById("run");
const continueBtn      = document.getElementById("continueBtn");
const retryBtn         = document.getElementById("retryBtn");
const stopBtn          = document.getElementById("stop");
const connBar          = document.getElementById("connBar");
const connDot          = document.getElementById("connDot");
const connMsg          = document.getElementById("connMsg");
const connLink         = document.getElementById("connLink");
const agentBar         = document.getElementById("agentBar");
const agentMsg         = document.getElementById("agentMsg");
const agentBadge       = document.getElementById("agentBadge");
const helpDialog       = document.getElementById("helpDialog");
const helpOpen         = document.getElementById("helpOpen");
const helpClose        = document.getElementById("helpClose");
const helpBodyEl       = document.getElementById("helpBody");
const listSection      = document.getElementById("listSection");
const promptListEl     = document.getElementById("promptList");
const listCountEl      = document.getElementById("listCount");
const downloadFolderEl = document.getElementById("downloadFolder");
const serialToggleEl   = document.getElementById("serialToggle");
const langSelectEl     = document.getElementById("langSelect");
const openDlSettings   = document.getElementById("openDlSettings");

// ─────────────────────────────────────────────
// Version from manifest
const { version } = chrome.runtime.getManifest();
if (versionTagEl) versionTagEl.textContent = `v${version}`;

// Show update banner if installed version is behind LATEST_VERSION
// Only shown once — dismissed state saved in storage per version
(function checkUpdateBanner() {
  const updateBar     = document.getElementById("updateBar");
  const updateDismiss = document.getElementById("updateDismiss");
  if (!updateBar) return;

  function versionIsOlder(installed, latest) {
    const a = installed.split(".").map(Number);
    const b = latest.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) < (b[i] || 0)) return true;
      if ((a[i] || 0) > (b[i] || 0)) return false;
    }
    return false;
  }

  if (!versionIsOlder(version, LATEST_VERSION)) return; // already up to date

  chrome.storage.local.get("eltonUpdateDismissed", (r) => {
    if (r.eltonUpdateDismissed === LATEST_VERSION) return; // already dismissed for this version
    updateBar.style.display = "";
  });

  updateDismiss.addEventListener("click", () => {
    updateBar.style.display = "none";
    chrome.storage.local.set({ eltonUpdateDismissed: LATEST_VERSION });
  });
})();

// ─────────────────────────────────────────────
// TXT file upload
// ─────────────────────────────────────────────
if (txtUploadEl) {
  txtUploadEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result || "";
      // Each non-empty line becomes a prompt
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      promptsEl.value = lines.join("\n");
      rebuildList();
      persist();
    };
    reader.readAsText(file);
    txtUploadEl.value = ""; // reset so same file can be re-uploaded
  });
}

// ─────────────────────────────────────────────
// i18n strings
// ─────────────────────────────────────────────
const LANGS = {
  pt: {
    promptQueueLabel:  "Fila de prompts",
    promptQueueHint:   "Um prompt por linha · a lista atualiza enquanto você digita",
    queueTitle:        "Fila",
    promptCount:       (n) => `${n} prompt${n === 1 ? "" : "s"}`,
    delayFrom:         "Atraso aleatório de",
    delayTo:           "a",
    delaySec:          "seg",
    downloadFolderLabel: "Pasta de download",
    autoDownload:      "Salvar auto",
    checkPage:         "Verificar página",
    runQueue:          "Iniciar geração",
    stop:              "Parar",
    statusPending:     "Pendente",
    statusGenerating:  "Gerando…",
    statusDone:        "Pronto ✓",
    statusFailed:      "Erro ✗",
    statusStopped:     "Ignorado",
    helpTitle:         "Como começar",
    helpClose:         "Entendido",
    helpDelayTitle:    "Atraso aleatório",
    helpDelayBody:     "Após cada geração, ELTON FLOW aguarda um tempo aleatório dentro do intervalo configurado antes de iniciar o próximo prompt.",
    helpBody: `
      <p class="lede">① Acesse seu projeto do Google Flow:<br/>
        <a class="path-link" href="https://labs.google/fx/tools/flow/project/" target="_blank">
          https://labs.google/fx/tools/flow/project/
        </a>
      </p>
      <p class="lede">② Digite seus prompts abaixo — um por linha. A fila atualiza em tempo real.</p>
      <p class="lede">③ Clique em <strong>Iniciar geração</strong>. ELTON FLOW gera cada imagem e faz o download automaticamente.</p>`,
    placeholder: "Uma bicicleta vermelha numa rua chuvosa\nUma raposa em aquarela na floresta\nBeco neon ao entardecer, cinematográfico",
    msgStarting:    (n)   => `Iniciando ${n} prompt(s)…`,
    msgSubmitting:  (i,n) => `Enviando prompt ${i} de ${n}…`,
    msgWaiting:     (i)   => `Prompt ${i} enviado — aguardando geração…`,
    msgDownloading: (i)   => `Prompt ${i} pronto ✓ — baixando imagem…`,
    msgDone:        (i)   => `Próximo em ${i}s…`,
    msgAllDone:     (n)   => `✓ ${n} prompt(s) gerados.`,
    msgPartDone:    (c,n) => `Pronto: ${c} de ${n} gerados.`,
    msgStopped:     "Parado.",
    msgChecking:    "Verificando…",
    msgConnected:   (h)   => `Conectado: ${h}`,
    msgNoTab:       "Nenhuma aba ativa.",
    msgNotReady:    "Script não pronto. Abra uma aba do projeto Flow e atualize.",
    msgTimeout:     (i)   => `Prompt ${i} expirou.`,
    msgError:       (i,e) => `Erro no prompt ${i}: ${e}`,
    msgAddPrompt:   "Adicione pelo menos um prompt.",
    msgOpenProject: "Abra uma página de projeto Flow primeiro (URL deve conter /project/).",
  },
  en: {
    promptQueueLabel:  "Prompt queue",
    promptQueueHint:   "One prompt per line · list updates as you type",
    queueTitle:        "Queue",
    promptCount:       (n) => `${n} prompt${n === 1 ? "" : "s"}`,
    delayFrom:         "Random delay from",
    delayTo:           "To",
    delaySec:          "sec",
    downloadFolderLabel: "Download folder",
    autoDownload:      "Auto-save",
    checkPage:         "Check page",
    runQueue:          "Start Generation",
    stop:              "Stop",
    statusPending:     "Pending",
    statusGenerating:  "Generating…",
    statusDone:        "Done ✓",
    statusFailed:      "Failed ✗",
    statusStopped:     "Skipped",
    helpTitle:         "Getting Started",
    helpClose:         "Got it",
    helpDelayTitle:    "Random delay",
    helpDelayBody:     "After each generation, ELTON FLOW waits a random number of seconds within your set range before starting the next prompt.",
    helpBody: `
      <p class="lede">① Go to your Google Flow project:<br/>
        <a class="path-link" href="https://labs.google/fx/tools/flow/project/" target="_blank">
          https://labs.google/fx/tools/flow/project/
        </a>
      </p>
      <p class="lede">② Enter your prompts below — one per line. Your queue updates as you type.</p>
      <p class="lede">③ Click <strong>Start Generation</strong>. ELTON FLOW generates each image one at a time and downloads it automatically.</p>`,
    placeholder: "A red bicycle on a rainy street\nA watercolor fox in a forest\nNeon alley at dusk, cinematic",
    msgStarting:    (n)   => `Starting ${n} prompt(s)…`,
    msgSubmitting:  (i,n) => `Submitting prompt ${i} of ${n}…`,
    msgWaiting:     (i)   => `Prompt ${i} submitted — waiting for generation…`,
    msgDownloading: (i)   => `Prompt ${i} done ✓ — downloading image…`,
    msgDone:        (i)   => `Next prompt in ${i}s…`,
    msgAllDone:     (n)   => `✓ All ${n} prompt(s) generated.`,
    msgPartDone:    (c,n) => `Done: ${c} of ${n} generated.`,
    msgStopped:     "Stopped.",
    msgChecking:    "Checking…",
    msgConnected:   (h)   => `Connected: ${h}`,
    msgNoTab:       "No active tab.",
    msgNotReady:    "Content script not ready. Open a Flow project tab and refresh.",
    msgTimeout:     (i)   => `Prompt ${i} timed out.`,
    msgError:       (i,e) => `Error on prompt ${i}: ${e}`,
    msgAddPrompt:   "Add at least one prompt.",
    msgOpenProject: "Please open a Flow project page first (URL must contain /project/).",
  },
  es: {
    promptQueueLabel:  "Cola de prompts",
    promptQueueHint:   "Un prompt por línea · la lista se actualiza al escribir",
    queueTitle:        "Cola",
    promptCount:       (n) => `${n} prompt${n === 1 ? "" : "s"}`,
    delayFrom:         "Demora aleatoria de",
    delayTo:           "a",
    delaySec:          "seg",
    downloadFolderLabel: "Carpeta de descarga",
    autoDownload:      "Guardado auto",
    checkPage:         "Verificar página",
    runQueue:          "Ejecutar cola",
    stop:              "Detener",
    statusPending:     "Pendiente",
    statusGenerating:  "Generando…",
    statusDone:        "Listo ✓",
    statusFailed:      "Error ✗",
    statusStopped:     "Omitido",
    helpTitle:         "Cómo empezar",
    helpClose:         "Entendido",
    helpDelayTitle:    "Demora aleatoria",
    helpDelayBody:     "Tras cada generación, ELTON FLOW espera un tiempo aleatorio dentro del rango configurado antes de iniciar el siguiente prompt.",
    helpBody: `
      <p class="lede">① Ve a tu proyecto de Google Flow:<br/>
        <a class="path-link" href="https://labs.google/fx/tools/flow/project/" target="_blank">
          https://labs.google/fx/tools/flow/project/
        </a>
      </p>
      <p class="lede">② Escribe tus prompts abajo — uno por línea. La cola se actualiza al instante.</p>
      <p class="lede">③ Haz clic en <strong>Ejecutar cola</strong>. ELTON FLOW genera cada imagen una a una y la descarga automáticamente.</p>`,
    placeholder: "Una bicicleta roja en una calle lluviosa\nUn zorro en acuarela en el bosque\nCallejón neón al atardecer",
    msgStarting:    (n)   => `Iniciando ${n} prompt(s)…`,
    msgSubmitting:  (i,n) => `Enviando prompt ${i} de ${n}…`,
    msgWaiting:     (i)   => `Prompt ${i} enviado — esperando generación…`,
    msgDownloading: (i)   => `Prompt ${i} listo ✓ — descargando…`,
    msgDone:        (i)   => `Siguiente en ${i}s…`,
    msgAllDone:     (n)   => `✓ ${n} prompt(s) generados.`,
    msgPartDone:    (c,n) => `Hecho: ${c} de ${n}.`,
    msgStopped:     "Detenido.",
    msgChecking:    "Verificando…",
    msgConnected:   (h)   => `Conectado: ${h}`,
    msgNoTab:       "No hay pestaña activa.",
    msgNotReady:    "Script no listo. Abre la página del proyecto Flow y recarga.",
    msgTimeout:     (i)   => `Prompt ${i} superó el tiempo límite.`,
    msgError:       (i,e) => `Error en prompt ${i}: ${e}`,
    msgAddPrompt:   "Añade al menos un prompt.",
    msgOpenProject: "Abre primero una página de proyecto Flow (URL debe contener /project/).",
  },
};

// ─────────────────────────────────────────────
// Language / i18n
// ─────────────────────────────────────────────
let currentLang = "pt";

function t(key, ...args) {
  const s = LANGS[currentLang]?.[key] ?? LANGS.pt[key];
  return typeof s === "function" ? s(...args) : (s ?? key);
}

function applyLanguage() {
  const L = LANGS[currentLang] || LANGS.pt;

  // Static data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const val = L[key];
    if (val && typeof val === "string") el.textContent = val;
  });

  // Help body (HTML)
  if (helpBodyEl) helpBodyEl.innerHTML = L.helpBody || LANGS.pt.helpBody;

  // Rebuild list count label
  rebuildList();
}

langSelectEl.addEventListener("change", () => {
  currentLang = langSelectEl.value;
  applyLanguage();
  chrome.storage.local.set({ eltonLang: currentLang });
});

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomWait(minMs, maxMs) {
  return minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs + 1));
}

function setStatus(text) { statusEl.textContent = text; }

let flowTabId     = null; // locked-in tab ID during generation
let resumeFromIdx = null; // index to resume from after a stop/failure

function setInputsDisabled(disabled) {
  promptsEl.disabled        = disabled;
  serialToggleEl.disabled   = disabled;
  downloadFolderEl.disabled = disabled;
  openDlSettings.disabled   = disabled;
  waitMinEl.disabled        = disabled;
  waitMaxEl.disabled        = disabled;
  txtUploadEl.disabled      = disabled;
  const opacity = disabled ? "0.45" : "";
  [promptsEl, serialToggleEl, downloadFolderEl, openDlSettings, waitMinEl, waitMaxEl, txtUploadEl]
    .forEach(el => el.style.opacity = opacity);
  // Also fade the label button visually
  const uploadLabel = document.querySelector(".btn-txt-upload");
  if (uploadLabel) uploadLabel.style.opacity = opacity;
}

function showContinue(fromIndex) {
  resumeFromIdx = fromIndex;
  continueBtn.style.display = "";
  continueBtn.textContent   = `▶ Continue from #${fromIndex + 1}`;
  runBtn.disabled = true; // keep Start Generation disabled
}

function hideContinue() {
  resumeFromIdx = null;
  continueBtn.style.display = "none";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToFlowTab(message, { retries = 5, retryDelayMs = 3000 } = {}) {
  // During generation use the saved tab ID so switching tabs doesn't break it
  const tabId = flowTabId || (await getActiveTab())?.id;
  if (!tabId) { setStatus(t("msgNoTab")); return null; }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      if (attempt === retries) {
        setStatus(t("msgNotReady"));
        return null;
      }
      // Content script likely reloading — wait and retry
      setStatus(`Page reloading… retrying in ${Math.round(retryDelayMs / 1000)}s (${attempt + 1}/${retries})`);
      await sleep(retryDelayMs);
    }
  }
}

// ─────────────────────────────────────────────
// Help dialog
// ─────────────────────────────────────────────
if (helpOpen  && helpDialog?.showModal) helpOpen.addEventListener("click",  () => helpDialog.showModal());
if (helpClose && helpDialog?.close)     helpClose.addEventListener("click", () => helpDialog.close());

// ─────────────────────────────────────────────
// Auto-download settings link
// ─────────────────────────────────────────────
openDlSettings?.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://settings/downloads" });
});

// ─────────────────────────────────────────────
// html escape
// ─────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────
// Prompt list
// ─────────────────────────────────────────────
let promptStatuses = [];
let isRunning = false;

function statusLabel(s) {
  return t("status" + s.charAt(0).toUpperCase() + s.slice(1));
}

function parsePrompts() {
  return promptsEl.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}

function rebuildList() {
  const lines = parsePrompts();
  if (!lines.length) { listSection.style.display = "none"; return; }

  const prev = promptStatuses;
  promptStatuses = lines.map((text, i) => ({
    text,
    status: (prev[i] && prev[i].text === text) ? prev[i].status : "pending",
  }));

  renderList();
  listSection.style.display = "";
  const n = lines.length;
  listCountEl.textContent = t("promptCount", n);
}

function renderList() {
  promptListEl.innerHTML = "";
  promptStatuses.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "prompt-item" + statusClass(item.status);
    row.id = `pr-${i}`;
    row.innerHTML =
      `<span class="prompt-num">${i + 1}</span>` +
      `<span class="prompt-text" title="${escHtml(item.text)}">${escHtml(item.text)}</span>` +
      `<span class="prompt-status s-${item.status}">${statusLabel(item.status)}</span>`;
    promptListEl.appendChild(row);
  });
}

function statusClass(s) {
  return s === "generating" ? " is-running"
       : s === "done"       ? " is-done"
       : s === "failed"     ? " is-failed"
       : s === "stopped"    ? " is-stopped" : "";
}

function updateStatus(index, status) {
  if (index < 0 || index >= promptStatuses.length) return;
  promptStatuses[index].status = status;
  const row = document.getElementById(`pr-${index}`);
  if (!row) return;
  row.className = "prompt-item" + statusClass(status);
  const badge = row.querySelector(".prompt-status");
  if (badge) { badge.className = `prompt-status s-${status}`; badge.textContent = statusLabel(status); }
  if (status === "generating") row.scrollIntoView({ block: "nearest" });
}

promptsEl.addEventListener("input", () => {
  if (!isRunning) {
    rebuildList();
    hideContinue();        // clear resume state when prompts change
    hideRetry();           // índices de erro ficam inválidos se os prompts mudam
    runBtn.disabled = !connBar.classList.contains("is-connected") || agentModeOn;
  }
});

// ─────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────
async function countdown(seconds) {
  for (let s = seconds; s > 0 && isRunning; s--) {
    setStatus(t("msgDone", s));
    await sleep(1000);
  }
}

// ─────────────────────────────────────────────
// Download
// ─────────────────────────────────────────────
function safePromptName(text) {
  return text
    .slice(0, 30)
    .replace(/:/g, "-")            // ALL colons → dash (: not allowed in filenames)
    .replace(/\s+/g, "_")
    .replace(/[^\w_\[\]\-]/g, "")  // keep [ ] - along with word chars
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 25);
}

async function downloadGeneratedImages(newUrls, serialNum, promptText) {
  const folder      = (downloadFolderEl.value || "elton-img").replace(/[/\\]+$/, "");
  const name        = safePromptName(promptText);
  const serial      = String(serialNum).padStart(2, "0");
  const useSerial   = serialToggleEl.checked;

  for (let j = 0; j < newUrls.length; j++) {
    let url = newUrls[j];
    if (!url.startsWith("http")) url = "https://labs.google" + url;
    const suffix   = newUrls.length > 1 ? `_${j + 1}` : "";
    const baseName = useSerial ? `${serial}_${name}` : name;
    const filename = `${folder}/${baseName}${suffix}.jpg`;
    try { await chrome.downloads.download({ url, filename, saveAs: false }); }
    catch (e) { console.warn("[ELTON FLOW] Download failed:", e); }
  }
}

// ─────────────────────────────────────────────
// Auto connection check
// ─────────────────────────────────────────────
const FLOW_BASE    = "https://labs.google/fx/tools/flow";
const FLOW_PROJECT = "https://labs.google/fx/tools/flow/project/";
// Regex to match localized URLs like /fx/fr/tools/flow/... or /fx/zh-TW/tools/flow/... or /fx/tools/flow/...
const FLOW_PROJECT_RE = /labs\.google\/fx(?:\/[a-z]{2,}(?:-[a-zA-Z]{2,})?)?\/tools\/flow\/project\//;
const FLOW_BASE_RE    = /labs\.google\/fx(?:\/[a-z]{2,}(?:-[a-zA-Z]{2,})?)?\/tools\/flow/;

let agentModeOn = false;

async function checkAgentMode() {
  const res = await sendToFlowTab({ type: "FLOW_GET_AGENT_MODE" });
  if (!res?.found) { agentBar.style.display = "none"; return; }

  agentModeOn = res.isOn;
  agentBar.style.display = "";

  if (res.isOn) {
    agentBar.className = "agent-bar is-on";
    agentMsg.textContent = "Turn off Agent mode to start generation";
    agentBadge.textContent = "ON";
    agentBadge.className = "agent-badge is-on";
    if (!isRunning) runBtn.disabled = true;
  } else {
    agentBar.className = "agent-bar is-off";
    agentMsg.textContent = "Agent mode";
    agentBadge.textContent = "OFF";
    agentBadge.className = "agent-badge is-off";
    if (!isRunning) runBtn.disabled = false;
  }
}

function setConnected() {
  connBar.className = "conn-bar is-connected";
  connMsg.textContent = "Connected to Google Flow project";
  connLink.style.display = "none";
  if (!isRunning) runBtn.disabled = false;
  checkAgentMode();
}

function setOpenProject() {
  connBar.className = "conn-bar is-warn";
  connMsg.textContent = "Open a project to continue";
  connLink.style.display = "none";
  agentBar.style.display = "none";
  if (!isRunning) runBtn.disabled = true;
}

function setGoToFlow() {
  connBar.className = "conn-bar is-off";
  connMsg.textContent = "Not on Google Flow";
  connLink.style.display = "";
  connLink.textContent = "Go to Google Flow →";
  connLink.href = FLOW_BASE;
  agentBar.style.display = "none";
  if (!isRunning) runBtn.disabled = true;
}

async function checkConnection() {
  const tab = await getActiveTab();
  const url = tab?.url || "";
  if (FLOW_PROJECT_RE.test(url)) {
    setConnected();
  } else if (FLOW_BASE_RE.test(url)) {
    // On labs.google/fx/.../tools/flow but no project open
    setOpenProject();
  } else {
    // Completely different URL
    setGoToFlow();
  }
}

// Check on load
checkConnection();

// Poll agent mode every 3 seconds when connected
setInterval(() => { if (connBar.classList.contains("is-connected")) checkAgentMode(); }, 3000);


// Re-check whenever the active tab URL changes
chrome.tabs.onActivated.addListener(() => checkConnection());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) checkConnection();
    });
  }
});

// ─────────────────────────────────────────────
// Run queue
// ─────────────────────────────────────────────
async function startQueue(startIndex = 0, onlyIndices = null) {
  const lines = parsePrompts();
  if (!lines.length) { setStatus(t("msgAddPrompt")); return; }

  let waitMinMs = Math.round(Number(waitMinEl.value) * 1000) || 0;
  let waitMaxMs = Math.round(Number(waitMaxEl.value) * 1000) || 0;
  if (waitMaxMs < waitMinMs) [waitMinMs, waitMaxMs] = [waitMaxMs, waitMinMs];

  // Lock in the Flow tab ID
  const activeTab = await getActiveTab();
  if (!activeTab?.id) { setStatus(t("msgNoTab")); return; }
  flowTabId = activeTab.id;

  // Lista de índices a processar:
  //  - modo normal: range contíguo de startIndex até o fim
  //  - modo "regerar erros": só os índices passados em onlyIndices
  const indices = onlyIndices
    ? onlyIndices.filter(j => j >= 0 && j < lines.length)
    : Array.from({ length: lines.length - startIndex }, (_, k) => startIndex + k);

  // On fresh start reset all statuses; on continue/retry keep existing,
  // só os índices que vamos processar voltam para "pending".
  if (!onlyIndices && startIndex === 0) {
    promptStatuses = lines.map(text => ({ text, status: "pending" }));
  } else {
    for (const j of indices) {
      if (promptStatuses[j]) promptStatuses[j].status = "pending";
    }
  }
  renderList();
  listSection.style.display = "";
  hideRetry();

  isRunning = true;
  runBtn.disabled = true;
  hideContinue();
  setInputsDisabled(true);
  appEl.classList.add("is-running");
  let completed = 0;
  setStatus(t("msgStarting", lines.length));

  // Conjunto GLOBAL de imagens já vistas/baixadas. Começa com as imagens que
  // já existem no projeto Flow, para o primeiro prompt não capturar nenhuma
  // delas. Cada prompt adiciona aqui as imagens que gerou — assim uma imagem
  // nunca é atribuída a dois prompts (evita o embaralhamento).
  const seenSrcs = new Set();
  const initialTiles = await sendToFlowTab({ type: "FLOW_GET_TILE_COUNT" });
  (initialTiles?.srcs || []).forEach(s => seenSrcs.add(s));

  for (let pos = 0; pos < indices.length; pos++) {
    const i = indices[pos];
    if (!isRunning) {
      for (let q = pos; q < indices.length; q++) updateStatus(indices[q], "stopped");
      showContinue(i); // offer to resume from this point
      break;
    }

    updateStatus(i, "generating");
    let promptDone = false;

    for (let attempt = 0; attempt <= 1; attempt++) {
      if (!isRunning) break;

      if (attempt === 1) {
        // Countdown before retry
        for (let s = 3; s > 0 && isRunning; s--) {
          setStatus(`Prompt ${i + 1} failed — retrying in ${s}s…`);
          await sleep(1000);
        }
        if (!isRunning) break;
        updateStatus(i, "generating");
        setStatus(`Prompt ${i + 1} — retrying…`);
      } else {
        setStatus(t("msgSubmitting", i + 1, lines.length));
      }

      const countRes        = await sendToFlowTab({ type: "FLOW_GET_TILE_COUNT" });
      const beforeFailCount = countRes?.failCount  ?? 0;

      const submitRes = await sendToFlowTab({
        type: "FLOW_BATCH_RUN",
        prompts: [lines[i]],
        waitMinMs: 0, waitMaxMs: 0,
        charDelayMs: CHAR_DELAY_MS, refImage: null,
      });

      if (!isRunning) break;

      if (!submitRes || submitRes.error) {
        if (attempt < 1) continue; // retry
        updateStatus(i, "failed");
        setStatus(t("msgError", i + 1, submitRes?.error || "no response"));
        for (let q = pos + 1; q < indices.length; q++) updateStatus(indices[q], "stopped");
        showContinue(i); // offer to retry from this failed prompt
        isRunning = false;
        break;
      }

      setStatus(t("msgWaiting", i + 1));
      // Passa o conjunto GLOBAL de vistas — a espera só considera imagens que
      // NENHUM prompt anterior já capturou.
      const genRes = await sendToFlowTab({
        type: "FLOW_WAIT_GENERATION",
        seenSrcs: [...seenSrcs],
        beforeFailCount,
        timeoutMs: 180000,
      });

      if (!isRunning) break;

      if (genRes?.failed || genRes?.timeout) {
        if (attempt < 1) continue; // will show countdown at top of loop
        // Both attempts failed — mark failed, move to next prompt
        updateStatus(i, "failed");
        const why = genRes?.reason ? ` — Flow: "${genRes.reason}"`
                  : genRes?.timeout ? " (tempo esgotado)" : "";
        setStatus(`Prompt ${i + 1} falhou${why}. Seguindo para o próximo.`);
        promptDone = true; // continue queue
        break;
      }

      // Sucesso. genRes.newUrls = todas as imagens novas estáveis deste prompt.
      // Marca TODAS como vistas (pra nenhuma vazar para o próximo prompt) e
      // baixa só a PRIMEIRA — uma imagem por prompt, sempre a deste prompt.
      const newUrls = genRes?.newUrls || [];
      newUrls.forEach(u => seenSrcs.add(u));
      if (newUrls.length > 0) {
        setStatus(t("msgDownloading", i + 1));
        await downloadGeneratedImages([newUrls[0]], i + 1, lines[i]);
      }

      updateStatus(i, "done");
      completed++;
      promptDone = true;
      break; // no retry needed
    }

    // promptDone = true means either success or skip-after-fail — both continue queue
    // promptDone = false only if isRunning was set to false (submit error path)

    if (pos < indices.length - 1 && isRunning) {
      const pause = randomWait(waitMinMs, waitMaxMs);
      await countdown(Math.round(pause / 1000));
    }
  }

  isRunning = false;
  flowTabId = null;
  setInputsDisabled(false);
  appEl.classList.remove("is-running");

  const failedCount  = promptStatuses.filter(p => p.status === "failed").length;
  const stoppedCount = promptStatuses.filter(p => p.status === "stopped").length;

  // Se sobrou qualquer prompt com erro (failed) ou pulado (stopped), mostra o
  // botão "Regerar com erro" que reprocessa SÓ esses, sem refazer os que deram certo.
  if (failedCount > 0 || stoppedCount > 0) showRetry(failedCount + stoppedCount);
  else hideRetry();

  if (stoppedCount > 0) {
    // Queue stopped for any reason with skipped prompts — offer to continue
    const firstStopped = promptStatuses.findIndex(p => p.status === "stopped");
    showContinue(firstStopped);
    runBtn.disabled = true;
    setStatus(`Parado — ${completed} prontas, ${stoppedCount} puladas.`);
  } else {
    // Queue ran through all prompts — no Continue needed
    hideContinue();
    runBtn.disabled = false;
    if (failedCount > 0) {
      setStatus(`Pronto — ${completed} geradas, ${failedCount} com erro. Clique "Regerar com erro".`);
    } else {
      setStatus(t("msgAllDone", completed));
    }
  }
}

runBtn.addEventListener("click", () => startQueue(0));

// ─────────────────────────────────────────────
// Regerar com erro — reprocessa só os prompts "failed" ou "stopped"
// ─────────────────────────────────────────────
function showRetry(n) {
  if (!retryBtn) return;
  retryBtn.style.display = "";
  retryBtn.textContent = `↻ Regerar com erro (${n})`;
}
function hideRetry() {
  if (retryBtn) retryBtn.style.display = "none";
}
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    const idx = promptStatuses
      .map((p, i) => ((p.status === "failed" || p.status === "stopped") ? i : -1))
      .filter(i => i >= 0);
    if (idx.length) startQueue(0, idx);
  });
}

// ─────────────────────────────────────────────
// Continue
// ─────────────────────────────────────────────
continueBtn.addEventListener("click", () => {
  if (resumeFromIdx !== null) startQueue(resumeFromIdx);
});

// ─────────────────────────────────────────────
// Stop
// ─────────────────────────────────────────────
stopBtn.addEventListener("click", async () => {
  isRunning = false;
  flowTabId = null;
  await sendToFlowTab({ type: "FLOW_BATCH_STOP" });
  setStatus(t("msgStopped"));
  setInputsDisabled(false);
  appEl.classList.remove("is-running");
  // runBtn stays disabled — Continue button is shown by the loop
});

// ─────────────────────────────────────────────
// Persist / restore
// ─────────────────────────────────────────────
// On launch — restore only settings (delay, folder, language)
// Prompts always start fresh every session
chrome.storage.local.get(
  ["flowBatchWaitMin", "flowBatchWaitMax", "eltonLang", "eltonSerial", "flowBatchFolder"],
  (r) => {
    if (r.flowBatchWaitMin != null) waitMinEl.value = String(r.flowBatchWaitMin);
    if (r.flowBatchWaitMax != null) waitMaxEl.value = String(r.flowBatchWaitMax);
    downloadFolderEl.value = r.flowBatchFolder || "elton-img"; // restore saved folder or default
    if (r.eltonSerial != null) serialToggleEl.checked = r.eltonSerial;
    if (r.eltonLang) {
      currentLang = r.eltonLang;
      langSelectEl.value = currentLang;
    }
    applyLanguage();
  }
);

// Persist only settings, never prompts
function persist() {
  chrome.storage.local.set({
    flowBatchWaitMin: waitMinEl.value,
    flowBatchWaitMax: waitMaxEl.value,
    flowBatchFolder:  downloadFolderEl.value,
    eltonSerial:      serialToggleEl.checked,
  });
}
waitMinEl.addEventListener("change", persist);
waitMaxEl.addEventListener("change", persist);
downloadFolderEl.addEventListener("change", persist);
serialToggleEl.addEventListener("change", persist);
