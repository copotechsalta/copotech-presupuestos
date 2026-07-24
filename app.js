'use strict';

const STORAGE_KEYS = {
  history: 'copotech.history.v1',
  settings: 'copotech.settings.v1',
  draft: 'copotech.draft.v1'
};

const DEFAULT_SETTINGS = {
  responsible: 'Facundo Tapia',
  payment: 'Efectivo / Transferencia',
  phone: '351-686-3211',
  instagram: '@copotech.salta',
  address: 'Ingeniero Clemente 1525 · Salta',
  deposit: 30,
  validity: 7,
  guarantee: 'Garantía de 30 días sobre la reparación realizada. No cubre golpes, caídas, humedad, sulfatación, sobrecargas eléctricas, manipulación por terceros ni fallas distintas a la originalmente reparada. En pantallas no cubre roturas, manchas, líneas, presión, golpes ni daño táctil posterior a la entrega. Precios y plazos sujetos a disponibilidad de repuestos. Se recomienda realizar una copia de seguridad.'
};

const SAMPLE_BUDGET = {
  id: null,
  date: localDateISO(),
  validity: 7,
  delivery: '12 a 24 hs',
  client: '',
  model: '',
  color: '',
  serial: '',
  diagnosis: 'Pantalla / módulo dañado; el equipo no muestra imagen correctamente. Se recomienda reemplazo del módulo completo y prueba funcional.',
  work: 'Cambio de módulo completo, colocación, prueba de imagen y táctil. Limpieza del marco y sellado del equipo.',
  option1Name: 'OPCIÓN 1',
  option1Description: 'Módulo OLED de muy buena calidad. Repuesto + colocación + prueba.',
  option1Price: '',
  option2Enabled: true,
  option2Name: 'OPCIÓN 2',
  option2Description: 'Módulo original. Repuesto + colocación + prueba.',
  option2Price: ''
};

let settings = loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
let historyItems = loadJSON(STORAGE_KEYS.history, []);
let currentBudget = loadJSON(STORAGE_KEYS.draft, { ...SAMPLE_BUDGET, validity: settings.validity });
let deferredInstallPrompt = null;
let draftTimer = null;

const $ = (id) => document.getElementById(id);
const formIds = [
  'date', 'validity', 'delivery', 'client', 'model', 'color', 'serial',
  'diagnosis', 'work', 'option1Name', 'option1Description', 'option1Price',
  'option2Name', 'option2Description', 'option2Price'
];

window.addEventListener('DOMContentLoaded', init);

function init() {
  hydrateForm(currentBudget);
  hydrateSettingsForm();
  bindEvents();
  updateOption2State();
  updatePreview();
  renderHistory();
  fitPreview();
  registerServiceWorker();
  setupInstallFlow();
}

function bindEvents() {
  formIds.forEach((id) => {
    const element = $(id);
    element.addEventListener('input', onFormChanged);
    element.addEventListener('change', onFormChanged);
  });
  $('option2Enabled').addEventListener('change', () => {
    updateOption2State();
    onFormChanged();
  });

  ['option1Price', 'option2Price'].forEach((id) => {
    $(id).addEventListener('blur', (event) => {
      event.target.value = normalizePriceInput(event.target.value);
      onFormChanged();
    });
  });

  $('newBtn').addEventListener('click', newBudget);
  $('saveBtn').addEventListener('click', saveBudget);
  $('pdfBtn').addEventListener('click', downloadPdf);
  $('shareBtn').addEventListener('click', sharePdf);
  document.querySelectorAll('[data-action="save"]').forEach((button) => button.addEventListener('click', saveBudget));
  document.querySelectorAll('[data-action="pdf"]').forEach((button) => button.addEventListener('click', downloadPdf));
  document.querySelectorAll('[data-action="share"]').forEach((button) => button.addEventListener('click', sharePdf));

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('resetSettingsBtn').addEventListener('click', resetSettings);
  $('exportBtn').addEventListener('click', exportBackup);
  $('importInput').addEventListener('change', importBackup);
  $('clearHistoryBtn').addEventListener('click', clearHistory);

  window.addEventListener('resize', fitPreview);
  if ('ResizeObserver' in window) {
    new ResizeObserver(fitPreview).observe($('previewViewport'));
  }
}

function onFormChanged() {
  currentBudget = readForm();
  updatePreview();
  setStatus('Cambios sin guardar');
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => saveJSON(STORAGE_KEYS.draft, currentBudget), 300);
}

function hydrateForm(data) {
  const merged = { ...SAMPLE_BUDGET, ...data };
  formIds.forEach((id) => {
    if ($(id)) $(id).value = merged[id] ?? '';
  });
  $('option2Enabled').checked = merged.option2Enabled !== false;
  currentBudget = merged;
}

function readForm() {
  const data = { id: currentBudget.id || null };
  formIds.forEach((id) => data[id] = $(id).value.trim());
  data.validity = Number.parseInt($('validity').value, 10) || settings.validity;
  data.option2Enabled = $('option2Enabled').checked;
  return data;
}

function updateOption2State() {
  const enabled = $('option2Enabled').checked;
  $('option2Fields').querySelectorAll('input, textarea').forEach((element) => element.disabled = !enabled);
  $('previewOption2Row').style.display = enabled ? 'grid' : 'none';
}

function updatePreview() {
  const data = { ...readForm(), ...settings };
  const bindings = {
    ...data,
    dateFormatted: formatDate(data.date),
    color: data.color || '—',
    serial: data.serial || '—',
    option1PriceFormatted: formatPrice(data.option1Price),
    option2PriceFormatted: formatPrice(data.option2Price)
  };

  document.querySelectorAll('[data-bind]').forEach((node) => {
    const key = node.dataset.bind;
    node.textContent = bindings[key] ?? '';
  });
  updateOption2State();
  fitPreview();
}

function fitPreview() {
  const viewport = $('previewViewport');
  const documentElement = $('budgetDocument');
  if (!viewport || !documentElement) return;
  const innerWidth = Math.max(250, viewport.clientWidth - (window.innerWidth <= 560 ? 14 : 28));
  const scale = Math.min(1, innerWidth / 794);
  documentElement.style.transform = `scale(${scale})`;
  viewport.style.height = `${Math.ceil(1123 * scale + (window.innerWidth <= 560 ? 14 : 28))}px`;
}

function activateTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  const map = { editor: 'editorTab', history: 'historyTab', settings: 'settingsTab' };
  $(map[name]).classList.add('active');
  if (name === 'editor') setTimeout(fitPreview, 0);
  if (name === 'history') renderHistory();
}

function newBudget() {
  if (hasMeaningfulData(readForm()) && !confirm('¿Crear un presupuesto nuevo? Los cambios no guardados se perderán.')) return;
  currentBudget = { ...SAMPLE_BUDGET, id: null, date: localDateISO(), validity: settings.validity };
  hydrateForm(currentBudget);
  updateOption2State();
  updatePreview();
  saveJSON(STORAGE_KEYS.draft, currentBudget);
  setStatus('Presupuesto nuevo');
  activateTab('editor');
  $('client').focus();
}

function hasMeaningfulData(data) {
  return Boolean(data.client || data.model || data.option1Price || data.option2Price);
}

function validateBudget() {
  const form = $('budgetForm');
  if (!form.reportValidity()) return false;
  const data = readForm();
  if (!digitsOnly(data.option1Price)) {
    showMessage('Precio faltante', 'Ingresá el precio final de la opción 1.');
    $('option1Price').focus();
    return false;
  }
  if (data.option2Enabled && (!data.option2Name || !data.option2Description || !digitsOnly(data.option2Price))) {
    showMessage('Opción 2 incompleta', 'Completá nombre, descripción y precio, o desactivá la opción 2.');
    return false;
  }
  return true;
}

function saveBudget() {
  if (!validateBudget()) return;
  const data = readForm();
  const now = new Date().toISOString();
  if (!data.id) data.id = cryptoRandomId();
  const entry = { id: data.id, savedAt: now, data };
  const existingIndex = historyItems.findIndex((item) => item.id === data.id);
  if (existingIndex >= 0) historyItems[existingIndex] = entry;
  else historyItems.unshift(entry);
  historyItems.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  currentBudget = data;
  saveJSON(STORAGE_KEYS.history, historyItems);
  saveJSON(STORAGE_KEYS.draft, currentBudget);
  renderHistory();
  setStatus('Guardado');
  showMessage('Presupuesto guardado', 'Quedó almacenado en el historial de este dispositivo.');
}

function renderHistory() {
  const container = $('historyList');
  container.innerHTML = '';
  if (!historyItems.length) {
    container.innerHTML = '<div class="history-empty">Todavía no hay presupuestos guardados.</div>';
    return;
  }
  historyItems.forEach((entry) => {
    const data = entry.data;
    const card = document.createElement('article');
    card.className = 'history-card';
    card.innerHTML = `
      <h3>${escapeHtml(data.client || 'Sin nombre')}</h3>
      <p>${escapeHtml(data.model || 'Equipo sin especificar')}</p>
      <p>${formatDate(data.date)} · guardado ${formatDateTime(entry.savedAt)}</p>
      <p class="price">${escapeHtml(formatPrice(data.option1Price))}${data.option2Enabled ? ` / ${escapeHtml(formatPrice(data.option2Price))}` : ''}</p>
      <div class="history-card-actions">
        <button class="button button-secondary" type="button" data-load>Editar</button>
        <button class="button button-primary" type="button" data-pdf>PDF</button>
        <button class="button button-danger" type="button" data-delete>Eliminar</button>
      </div>`;
    card.querySelector('[data-load]').addEventListener('click', () => loadHistoryEntry(entry.id));
    card.querySelector('[data-pdf]').addEventListener('click', () => downloadHistoryPdf(entry.id));
    card.querySelector('[data-delete]').addEventListener('click', () => deleteHistoryEntry(entry.id));
    container.appendChild(card);
  });
}

function loadHistoryEntry(id) {
  const entry = historyItems.find((item) => item.id === id);
  if (!entry) return;
  currentBudget = { ...entry.data };
  hydrateForm(currentBudget);
  updateOption2State();
  updatePreview();
  saveJSON(STORAGE_KEYS.draft, currentBudget);
  setStatus('Presupuesto cargado');
  activateTab('editor');
}

async function downloadHistoryPdf(id) {
  const entry = historyItems.find((item) => item.id === id);
  if (!entry) return;
  const previous = currentBudget;
  currentBudget = { ...entry.data };
  try {
    await downloadPdfForData(currentBudget);
  } finally {
    currentBudget = previous;
  }
}

function deleteHistoryEntry(id) {
  if (!confirm('¿Eliminar este presupuesto del historial?')) return;
  historyItems = historyItems.filter((item) => item.id !== id);
  saveJSON(STORAGE_KEYS.history, historyItems);
  renderHistory();
}

function clearHistory() {
  if (!historyItems.length) return;
  if (!confirm('¿Vaciar todo el historial? Esta acción no se puede deshacer.')) return;
  historyItems = [];
  saveJSON(STORAGE_KEYS.history, historyItems);
  renderHistory();
}

function hydrateSettingsForm() {
  $('settingResponsible').value = settings.responsible;
  $('settingPayment').value = settings.payment;
  $('settingPhone').value = settings.phone;
  $('settingInstagram').value = settings.instagram;
  $('settingAddress').value = settings.address;
  $('settingDeposit').value = settings.deposit;
  $('settingValidity').value = settings.validity;
  $('settingGuarantee').value = settings.guarantee;
}

function saveSettings() {
  settings = {
    responsible: $('settingResponsible').value.trim() || DEFAULT_SETTINGS.responsible,
    payment: $('settingPayment').value.trim() || DEFAULT_SETTINGS.payment,
    phone: $('settingPhone').value.trim() || DEFAULT_SETTINGS.phone,
    instagram: $('settingInstagram').value.trim() || DEFAULT_SETTINGS.instagram,
    address: $('settingAddress').value.trim() || DEFAULT_SETTINGS.address,
    deposit: Math.min(100, Math.max(0, Number.parseInt($('settingDeposit').value, 10) || 0)),
    validity: Math.min(90, Math.max(1, Number.parseInt($('settingValidity').value, 10) || DEFAULT_SETTINGS.validity)),
    guarantee: $('settingGuarantee').value.trim() || DEFAULT_SETTINGS.guarantee
  };
  saveJSON(STORAGE_KEYS.settings, settings);
  updatePreview();
  showMessage('Ajustes guardados', 'Se aplicarán a los presupuestos nuevos y al PDF actual.');
}

function resetSettings() {
  if (!confirm('¿Restaurar los datos oficiales predeterminados?')) return;
  settings = { ...DEFAULT_SETTINGS };
  hydrateSettingsForm();
  saveJSON(STORAGE_KEYS.settings, settings);
  updatePreview();
}

function exportBackup() {
  const payload = {
    app: 'CopoTech Presupuestos',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    history: historyItems
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `copotech-respaldo-${localDateISO()}.json`);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || !Array.isArray(payload.history) || typeof payload.settings !== 'object') throw new Error('Formato inválido');
    if (!confirm(`Se importarán ${payload.history.length} presupuestos y se reemplazarán los ajustes actuales. ¿Continuar?`)) return;
    historyItems = payload.history;
    settings = { ...DEFAULT_SETTINGS, ...payload.settings };
    saveJSON(STORAGE_KEYS.history, historyItems);
    saveJSON(STORAGE_KEYS.settings, settings);
    hydrateSettingsForm();
    updatePreview();
    renderHistory();
    showMessage('Respaldo importado', 'Los datos fueron restaurados correctamente.');
  } catch (error) {
    showMessage('No se pudo importar', 'El archivo no es un respaldo válido de CopoTech Presupuestos.');
  }
}

async function downloadPdf() {
  if (!validateBudget()) return;
  await downloadPdfForData(readForm());
}

async function downloadPdfForData(data) {
  try {
    setStatus('Generando PDF…');
    const blob = await buildPdfBlob(data, settings);
    downloadBlob(blob, pdfFilename(data));
    setStatus('PDF generado');
  } catch (error) {
    console.error(error);
    setStatus('Error al generar PDF');
    showMessage('No se pudo generar el PDF', 'Revisá los datos e intentá nuevamente.');
  }
}

async function sharePdf() {
  if (!validateBudget()) return;
  const data = readForm();
  try {
    setStatus('Preparando archivo…');
    const blob = await buildPdfBlob(data, settings);
    const filename = pdfFilename(data);
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Presupuesto CopoTech', text: `Presupuesto para ${data.client}`, files: [file] });
      setStatus('Compartido');
    } else {
      downloadBlob(blob, filename);
      showMessage('PDF descargado', 'Este navegador no permite compartir archivos directamente. El PDF quedó listo para enviarlo desde Descargas o Archivos.');
      setStatus('PDF generado');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error(error);
      showMessage('No se pudo compartir', 'Se produjo un error al preparar el archivo.');
    }
    setStatus('Listo');
  }
}

function pdfFilename(data) {
  const client = sanitizeFilename(data.client || 'Cliente');
  const model = sanitizeFilename(data.model || 'Equipo');
  return `Presupuesto_CopoTech_${client}_${model}.pdf`;
}

function setStatus(text) {
  $('statusText').textContent = text;
}

function showMessage(title, message) {
  const dialog = $('messageDialog');
  $('dialogTitle').textContent = title;
  $('dialogMessage').textContent = message;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else alert(`${title}\n\n${message}`);
}

function setupInstallFlow() {
  const button = $('installBtn');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      button.hidden = true;
      return;
    }
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS) {
      showMessage('Instalar en iPhone o iPad', 'Abrí esta web en Safari, tocá Compartir y elegí “Agregar a pantalla de inicio”.');
    }
  });
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isiOS && !isStandalone) button.hidden = false;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker:', error));
  }
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredCloneSafe(fallback);
  } catch {
    return structuredCloneSafe(fallback);
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function localDateISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day} / ${month} / ${year}` : value;
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePriceInput(value) {
  const digits = digitsOnly(value);
  return digits ? new Intl.NumberFormat('es-AR').format(Number(digits)) : '';
}

function formatPrice(value) {
  const digits = digitsOnly(value);
  return digits ? `$${new Intl.NumberFormat('es-AR').format(Number(digits))}` : '$0';
}

function sanitizeFilename(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 45) || 'archivo';
}

function cryptoRandomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// -----------------------------------------------------------------------------
// Generador PDF vectorial, sin dependencias externas.
// -----------------------------------------------------------------------------

const MM_TO_PT = 72 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
let measureCanvas;
let pdfLogoPromise;

async function buildPdfBlob(data, appSettings) {
  const page = new PdfPage(A4_WIDTH_MM, A4_HEIGHT_MM);
  const red = '#d90416';
  const dark = '#101418';
  const line = '#d7dade';
  const soft = '#f7f7f8';
  await waitForPdfAssets();
  const logo = await loadPdfLogo();

  // Encabezado.
  page.rect(0, 0, 210, 34, { fill: dark });
  page.roundRect(149, -16, 76, 54, 26, { fill: red });
  // Logo oficial extraído de la plantilla visual. Ocupa casi toda la altura
  // del encabezado y conserva sus proporciones y bordes redondeados.
  page.image(logo, 3.8, 0.25, 33.5, 33.5);
  page.text(42.2, 17.2, 'CopoTech Salta', 20.2, { font: 'bold', color: '#ffffff' });
  page.text(42.2, 25.3, 'Servicio técnico especializado en celulares y PC', 8.0, { font: 'bold', color: '#ffffff' });

  // Contactos: mismo margen derecho, blanco puro y peso bold.
  const contactRightX = 199.2;
  page.text(contactRightX, 10.7, `WhatsApp: ${appSettings.phone}`, 8.8, { font: 'bold', color: '#ffffff', align: 'right' });
  page.text(contactRightX, 18.7, `Instagram: ${appSettings.instagram}`, 8.8, { font: 'bold', color: '#ffffff', align: 'right' });
  page.text(contactRightX, 26.7, appSettings.address, 8.5, { font: 'bold', color: '#ffffff', align: 'right' });

  // Título y metadatos en dos columnas fijas.
  page.text(10, 52, 'PRESUPUESTO', 29.5, { font: 'bold', color: '#111111' });
  const metaLabelX = 126;
  const metaValueX = 166;
  const metaStartY = 46;
  const metaRowGap = 7.5;
  drawMeta(page, metaLabelX, metaValueX, metaStartY, 'Fecha:', formatDate(data.date));
  drawMeta(page, metaLabelX, metaValueX, metaStartY + metaRowGap, 'Validez:', `${data.validity} días`);
  drawMeta(page, metaLabelX, metaValueX, metaStartY + metaRowGap * 2, 'Entrega estimada:', data.delivery);

  // Tarjetas.
  page.roundRect(10, 66, 92, 38, 3, { stroke: line, lineWidth: .35 });
  page.roundRect(108, 66, 92, 38, 3, { stroke: line, lineWidth: .35 });
  page.text(14, 74, 'CLIENTE', 9.7, { font: 'bold', color: red });
  drawField(page, 14, 81.5, 'Nombre:', data.client, 82);
  drawField(page, 14, 88.2, 'Modelo:', data.model, 82);
  drawField(page, 14, 94.9, 'Color final:', data.color || '—', 82);
  drawField(page, 14, 101.6, 'IMEI / Serie:', data.serial || '—', 82);

  page.text(112, 74, 'DATOS TÉCNICOS', 9.7, { font: 'bold', color: red });
  drawField(page, 112, 82.5, 'Responsable:', appSettings.responsible, 83);
  drawField(page, 112, 91.2, 'Forma de pago:', appSettings.payment, 83);

  // Diagnóstico.
  drawTextSection(page, 10, 112, 'DIAGNÓSTICO', data.diagnosis, red, soft, 23);
  drawTextSection(page, 10, 145, 'TRABAJO A REALIZAR', data.work, red, soft, 23);

  // Tabla de opciones.
  const tableX = 10;
  const tableY = 178;
  const tableW = 190;
  const col1 = 45;
  const col2 = 107;
  const col3 = tableW - col1 - col2;
  const headerH = 11;
  const rowH = 20;
  const rowCount = data.option2Enabled ? 2 : 1;
  const totalH = headerH + rowCount * rowH;
  page.roundRect(tableX, tableY, tableW, totalH, 2.5, { stroke: line, lineWidth: .35 });
  page.rect(tableX, tableY, tableW, headerH, { fill: red });
  page.line(tableX + col1, tableY, tableX + col1, tableY + totalH, { color: line, lineWidth: .3 });
  page.line(tableX + col1 + col2, tableY, tableX + col1 + col2, tableY + totalH, { color: line, lineWidth: .3 });
  page.text(tableX + col1 / 2, tableY + 7.2, 'OPCIÓN', 7.9, { font: 'bold', color: '#ffffff', align: 'center' });
  page.text(tableX + col1 + 6, tableY + 7.2, 'DESCRIPCIÓN', 7.9, { font: 'bold', color: '#ffffff' });
  page.text(tableX + col1 + col2 + col3 / 2, tableY + 5.2, 'PRECIO', 7.3, { font: 'bold', color: '#ffffff', align: 'center' });
  page.text(tableX + col1 + col2 + col3 / 2, tableY + 8.5, 'FINAL', 7.3, { font: 'bold', color: '#ffffff', align: 'center' });

  drawOptionRow(page, {
    y: tableY + headerH,
    h: rowH,
    x: tableX,
    col1,
    col2,
    col3,
    name: data.option1Name,
    description: data.option1Description,
    price: formatPrice(data.option1Price),
    line
  });
  if (data.option2Enabled) {
    page.line(tableX, tableY + headerH + rowH, tableX + tableW, tableY + headerH + rowH, { color: line, lineWidth: .3 });
    drawOptionRow(page, {
      y: tableY + headerH + rowH,
      h: rowH,
      x: tableX,
      col1,
      col2,
      col3,
      name: data.option2Name,
      description: data.option2Description,
      price: formatPrice(data.option2Price),
      line
    });
  }

  // Garantía, seña y firma.
  page.text(10, 235, 'GARANTÍA Y CONDICIONES', 9.2, { font: 'bold', color: red });
  page.paragraph(appSettings.guarantee, 10, 240, 125, 3.5, 6.2, { maxLines: 7, color: '#151515' });
  page.roundRect(10, 263, 122, 14, 2, { fill: '#fff1f3', stroke: '#f1c5cb', lineWidth: .3 });
  page.circle(17, 270, 4.3, { fill: red });
  // Centro óptico del glifo: se eleva levemente la línea base para que el
  // porcentaje no quede apoyado en la mitad inferior del círculo.
  page.text(17.04, 271.15, '%', 9.4, { font: 'bold', color: '#ffffff', align: 'center' });
  page.text(24, 268.3, `Para solicitar el repuesto se requiere una seña del ${appSettings.deposit}% del valor de la reparación.`, 6.0, { font: 'bold', color: '#111111' });
  page.text(24, 273.2, 'El trabajo comenzará una vez acreditada dicha seña.', 6.0, { color: '#111111' });

  page.line(140, 265, 198, 265, { color: '#222222', lineWidth: .35 });
  page.text(169, 271, appSettings.responsible, 8.2, { font: 'bold', align: 'center' });
  page.text(169, 276, 'Responsable técnico', 7.0, { align: 'center' });
  page.text(169, 281, 'Documento generado por CopoTech Salta', 5.2, { color: '#8b9196', align: 'center' });

  // Pie. Sin pseudo-elementos ni decoraciones rojas superpuestas.
  page.rect(4, 285, 202, 12, { fill: dark });
  page.text(13, 291, 'CopoTech Salta', 7.4, { font: 'bold', color: '#ffffff' });
  page.text(13, 294.2, 'Servicio técnico especializado · Reparaciones con garantía · Repuestos de calidad', 5.1, { color: '#ffffff' });
  page.text(198, 290.7, 'Facebook: CopoTech Salta', 5.7, { color: '#ffffff', align: 'right' });
  page.text(198, 294.3, `WhatsApp: ${appSettings.phone}`, 5.7, { color: '#ffffff', align: 'right' });

  return page.toBlob();
}

function drawMeta(page, labelX, valueX, y, label, value) {
  page.text(labelX, y, label, 8.2, { font: 'bold', color: '#d90416' });
  page.text(valueX, y, ellipsize(value, 34), 8.0, { font: 'bold', color: '#111111' });
}

function drawField(page, x, y, label, value, maxWidth) {
  page.text(x, y, label, 7.8, { font: 'bold', color: '#222222' });
  const labelW = measureTextMm(label, 7.8, true) + 2;
  page.text(x + labelW, y, ellipsizeToWidth(value, maxWidth - labelW, 7.8, false), 7.8, { color: '#111111' });
}

function drawTextSection(page, x, y, title, text, red, soft, height) {
  page.text(x, y, title, 9.3, { font: 'bold', color: red });
  page.rect(x, y + 4, 190, height, { fill: soft });
  page.rect(x, y + 4, 1.2, height, { fill: red });
  page.paragraph(text, x + 8, y + 11, 178, 4.9, 7.7, { maxLines: 3, color: '#151515' });
}

function drawOptionRow(page, args) {
  const { y, h, x, col1, col2, col3, name, description, price } = args;
  const nameFit = fitLines(name, col1 - 8, 8.7, true, 2);
  const nameStart = y + h / 2 - ((nameFit.lines.length - 1) * 4.2) / 2 + 1.4;
  nameFit.lines.forEach((lineText, index) => {
    page.text(x + col1 / 2, nameStart + index * 4.2, lineText, nameFit.fontSize, { font: 'bold', align: 'center' });
  });

  const descFit = fitLines(description, col2 - 10, 7.5, false, 3);
  const descStart = y + h / 2 - ((descFit.lines.length - 1) * 4.1) / 2 + 1.3;
  descFit.lines.forEach((lineText, index) => {
    page.text(x + col1 + 5, descStart + index * 4.1, lineText, descFit.fontSize, { color: '#111111' });
  });

  const priceSize = price.length > 10 ? 10.8 : 12.3;
  page.text(x + col1 + col2 + col3 / 2, y + h / 2 + 2.1, price, priceSize, { font: 'bold', align: 'center' });
}

class PdfPage {
  constructor(widthMm, heightMm) {
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    this.widthPt = widthMm * MM_TO_PT;
    this.heightPt = heightMm * MM_TO_PT;
    this.ops = [];
    this.images = [];
  }

  image(imageData, x, y, w, h) {
    const name = `Im${this.images.length + 1}`;
    this.images.push({ name, imageData });
    this.ops.push(`q ${num(w * MM_TO_PT)} 0 0 ${num(h * MM_TO_PT)} ${num(x * MM_TO_PT)} ${num(this.heightPt - (y + h) * MM_TO_PT)} cm /${name} Do Q`);
  }

  rect(x, y, w, h, options = {}) {
    this.#style(options);
    this.ops.push(`${num(x * MM_TO_PT)} ${num(this.heightPt - (y + h) * MM_TO_PT)} ${num(w * MM_TO_PT)} ${num(h * MM_TO_PT)} re ${paintOperator(options)}`);
  }

  roundRect(x, y, w, h, radius, options = {}) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    const k = 0.5522847498;
    const x0 = x * MM_TO_PT;
    const x1 = (x + w) * MM_TO_PT;
    const yTop = this.heightPt - y * MM_TO_PT;
    const yBottom = this.heightPt - (y + h) * MM_TO_PT;
    const rp = r * MM_TO_PT;
    this.#style(options);
    this.ops.push([
      `${num(x0 + rp)} ${num(yTop)} m`,
      `${num(x1 - rp)} ${num(yTop)} l`,
      `${num(x1 - rp + k * rp)} ${num(yTop)} ${num(x1)} ${num(yTop - rp + k * rp)} ${num(x1)} ${num(yTop - rp)} c`,
      `${num(x1)} ${num(yBottom + rp)} l`,
      `${num(x1)} ${num(yBottom + rp - k * rp)} ${num(x1 - rp + k * rp)} ${num(yBottom)} ${num(x1 - rp)} ${num(yBottom)} c`,
      `${num(x0 + rp)} ${num(yBottom)} l`,
      `${num(x0 + rp - k * rp)} ${num(yBottom)} ${num(x0)} ${num(yBottom + rp - k * rp)} ${num(x0)} ${num(yBottom + rp)} c`,
      `${num(x0)} ${num(yTop - rp)} l`,
      `${num(x0)} ${num(yTop - rp + k * rp)} ${num(x0 + rp - k * rp)} ${num(yTop)} ${num(x0 + rp)} ${num(yTop)} c`,
      `h ${paintOperator(options)}`
    ].join('\n'));
  }

  circle(cx, cy, radius, options = {}) {
    const k = 0.5522847498;
    const x = cx * MM_TO_PT;
    const y = this.heightPt - cy * MM_TO_PT;
    const r = radius * MM_TO_PT;
    this.#style(options);
    this.ops.push([
      `${num(x + r)} ${num(y)} m`,
      `${num(x + r)} ${num(y + k * r)} ${num(x + k * r)} ${num(y + r)} ${num(x)} ${num(y + r)} c`,
      `${num(x - k * r)} ${num(y + r)} ${num(x - r)} ${num(y + k * r)} ${num(x - r)} ${num(y)} c`,
      `${num(x - r)} ${num(y - k * r)} ${num(x - k * r)} ${num(y - r)} ${num(x)} ${num(y - r)} c`,
      `${num(x + k * r)} ${num(y - r)} ${num(x + r)} ${num(y - k * r)} ${num(x + r)} ${num(y)} c`,
      `h ${paintOperator(options)}`
    ].join('\n'));
  }

  line(x1, y1, x2, y2, options = {}) {
    this.#style({ stroke: options.color || '#000000', lineWidth: options.lineWidth ?? .3 });
    this.ops.push(`${num(x1 * MM_TO_PT)} ${num(this.heightPt - y1 * MM_TO_PT)} m ${num(x2 * MM_TO_PT)} ${num(this.heightPt - y2 * MM_TO_PT)} l S`);
  }

  text(x, y, text, fontSize, options = {}) {
    const value = sanitizePdfText(String(text ?? ''));
    const font = options.font === 'bold' ? 'F2' : 'F1';
    const color = options.color || '#111111';
    let xAdjusted = x;
    if (options.align === 'center') xAdjusted -= measureTextMm(value, fontSize, font === 'F2') / 2;
    if (options.align === 'right') xAdjusted -= measureTextMm(value, fontSize, font === 'F2');
    const [r, g, b] = hexToRgb(color);
    this.ops.push(`BT /${font} ${num(fontSize)} Tf ${num(r)} ${num(g)} ${num(b)} rg 1 0 0 1 ${num(xAdjusted * MM_TO_PT)} ${num(this.heightPt - y * MM_TO_PT)} Tm (${escapePdfLiteral(value)}) Tj ET`);
  }

  paragraph(text, x, y, width, lineHeightMm, fontSize, options = {}) {
    const fit = fitLines(text, width, fontSize, options.font === 'bold', options.maxLines || 99);
    fit.lines.forEach((line, index) => this.text(x, y + index * lineHeightMm, line, fit.fontSize, options));
    return fit.lines.length;
  }

  #style(options) {
    if (options.fill) {
      const [r, g, b] = hexToRgb(options.fill);
      this.ops.push(`${num(r)} ${num(g)} ${num(b)} rg`);
    }
    if (options.stroke) {
      const [r, g, b] = hexToRgb(options.stroke);
      this.ops.push(`${num(r)} ${num(g)} ${num(b)} RG`);
    }
    if (options.lineWidth != null) this.ops.push(`${num(options.lineWidth * MM_TO_PT)} w`);
  }

  toBlob() {
    const content = this.ops.join('\n') + '\n';
    const contentBytes = latin1Bytes(content);
    const objects = [];
    const imageObjectStart = 7;
    const xObjects = this.images.length
      ? `/XObject << ${this.images.map((image, index) => `/${image.name} ${imageObjectStart + index} 0 R`).join(' ')} >> `
      : '';

    objects[1] = latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2] = latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects[3] = latin1Bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.widthPt)} ${num(this.heightPt)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> ${xObjects}>> /Contents 4 0 R >>`);
    objects[4] = concatBytes(
      latin1Bytes(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      latin1Bytes('endstream')
    );
    objects[5] = latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects[6] = latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    this.images.forEach(({ imageData }, index) => {
      const imageBytes = imageData.data;
      objects[imageObjectStart + index] = concatBytes(
        latin1Bytes(`<< /Type /XObject /Subtype /Image /Width ${imageData.width} /Height ${imageData.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${imageData.width} >> /Length ${imageBytes.length} >>\nstream\n`),
        imageBytes,
        latin1Bytes('\nendstream')
      );
    });

    const header = latin1Bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const wrappedObjects = [];
    const offsets = [0];
    let offset = header.length;
    for (let i = 1; i < objects.length; i += 1) {
      const wrapped = concatBytes(latin1Bytes(`${i} 0 obj\n`), objects[i], latin1Bytes('\nendobj\n'));
      offsets[i] = offset;
      wrappedObjects.push(wrapped);
      offset += wrapped.length;
    }

    const xrefOffset = offset;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i += 1) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([header, ...wrappedObjects, latin1Bytes(xref)], { type: 'application/pdf' });
  }
}


async function waitForPdfAssets() {
  if (document.fonts?.ready) await document.fonts.ready;
  const logo = document.querySelector('#budgetDocument .doc-logo img');
  if (logo?.decode) {
    try { await logo.decode(); } catch { /* La carga por fetch se valida al crear el PDF. */ }
  }
}

function loadPdfLogo() {
  if (!pdfLogoPromise) {
    const logoElement = document.querySelector('#budgetDocument .doc-logo img');
    const source = logoElement?.currentSrc || logoElement?.src || new URL('icons/logo-copotech.png', document.baseURI).href;
    pdfLogoPromise = fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el logo (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => parseRgbPng(new Uint8Array(buffer)));
  }
  return pdfLogoPromise;
}

function parseRgbPng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) {
    throw new Error('El logo no es un PNG válido.');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error('PNG truncado.');
    if (type === 'IHDR') {
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      idat.push(bytes.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 2 || interlace !== 0 || !idat.length) {
    throw new Error('El logo PNG debe ser RGB de 8 bits y no entrelazado.');
  }
  return { width, height, data: concatBytes(...idat) };
}

function readUint32(bytes, offset) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function latin1Bytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 0xff;
  return bytes;
}

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function paintOperator(options) {
  if (options.fill && options.stroke) return 'B';
  if (options.fill) return 'f';
  return 'S';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function num(value) {
  return Number(value.toFixed(3)).toString();
}

function getMeasureContext() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

function measureTextMm(text, fontSizePt, bold = false) {
  const context = getMeasureContext();
  context.font = `${bold ? 700 : 400} ${fontSizePt * 96 / 72}px Arial, Helvetica, sans-serif`;
  return context.measureText(String(text)).width * 25.4 / 96;
}

function wrapText(text, widthMm, fontSizePt, bold = false) {
  const paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  const lines = [];
  paragraphs.forEach((paragraph, pIndex) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (measureTextMm(candidate, fontSizePt, bold) <= widthMm) {
        line = candidate;
      } else if (!line) {
        lines.push(ellipsizeToWidth(word, widthMm, fontSizePt, bold));
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (pIndex < paragraphs.length - 1) lines.push('');
  });
  return lines;
}

function fitLines(text, widthMm, preferredFontSize, bold, maxLines) {
  let fontSize = preferredFontSize;
  let lines = wrapText(text, widthMm, fontSize, bold);
  while (lines.length > maxLines && fontSize > 5) {
    fontSize -= .25;
    lines = wrapText(text, widthMm, fontSize, bold);
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = ellipsizeToWidth(`${lines[maxLines - 1]}…`, widthMm, fontSize, bold);
  }
  return { fontSize, lines };
}

function ellipsizeToWidth(text, widthMm, fontSizePt, bold) {
  let result = String(text || '');
  if (measureTextMm(result, fontSizePt, bold) <= widthMm) return result;
  while (result.length > 1 && measureTextMm(`${result}…`, fontSizePt, bold) > widthMm) result = result.slice(0, -1);
  return `${result.trim()}…`;
}

function ellipsize(value, maxLength) {
  const text = String(value || '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function sanitizePdfText(value) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function escapePdfLiteral(value) {
  return toWinAnsiBinary(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toWinAnsiBinary(value) {
  let output = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    output += String.fromCharCode(code <= 255 ? code : 63);
  }
  return output;
}

function binaryLength(value) {
  return value.length;
}

function binaryStringToBytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 0xff;
  return bytes;
}
