import { esc } from '../utils/format.js';

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1700);
}

// Un caricamento fallito deve dirlo. Senza, la schermata resta sullo scheletro
// di caricamento all'infinito e il motivo sparisce nella console.
export function showLoadError(el, err, what = 'i dati') {
  if (!el) return;
  el.innerHTML = `<div class="placeholder-card">Impossibile caricare ${esc(what)}.<br>
    <span class="hint">${esc((err && err.message) || 'Errore imprevisto')}</span></div>`;
}

export function confirmModal(title, body, onConfirm, confirmLabel) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box">
    <h3>${esc(title)}</h3><p>${esc(body)}</p>
    <div class="error-msg" id="modalError"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalCancel">Annulla</button>
      <button class="btn btn-primary" id="modalConfirm" style="width:auto;">${esc(confirmLabel || 'Conferma')}</button>
    </div></div></div>`;
  const cancelBtn = document.getElementById('modalCancel');
  const confirmBtn = document.getElementById('modalConfirm');
  const errEl = document.getElementById('modalError');
  let busy = false;
  cancelBtn.onclick = () => { if (!busy) root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (!busy && e.target.id === 'modalOverlay') root.innerHTML = ''; };
  confirmBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    const original = confirmBtn.textContent;
    confirmBtn.disabled = true; cancelBtn.disabled = true;
    confirmBtn.classList.add('btn-loading');
    try {
      await onConfirm();
      root.innerHTML = '';
    } catch (e) {
      errEl.textContent = e.message || 'Si è verificato un errore imprevisto.';
      busy = false;
      confirmBtn.disabled = false; cancelBtn.disabled = false;
      confirmBtn.classList.remove('btn-loading');
      confirmBtn.textContent = original;
    }
  };
}

export function formModal(title, fieldsHtml, onSubmit, opts) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box${opts && opts.wide ? ' wide' : ''}">
    <h3>${esc(title)}</h3>
    <div id="modalFields">${fieldsHtml}</div>
    <div class="error-msg" id="modalError"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalCancel">Annulla</button>
      <button class="btn btn-primary" id="modalConfirm" style="width:auto;">Salva</button>
    </div></div></div>`;
  const cancelBtn = document.getElementById('modalCancel');
  const confirmBtn = document.getElementById('modalConfirm');
  const errEl = document.getElementById('modalError');
  let busy = false;
  cancelBtn.onclick = () => { if (!busy) root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (!busy && e.target.id === 'modalOverlay') root.innerHTML = ''; };
  confirmBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    const original = confirmBtn.textContent;
    confirmBtn.disabled = true; cancelBtn.disabled = true;
    confirmBtn.classList.add('btn-loading');
    try {
      const err = await onSubmit();
      if (err) {
        errEl.textContent = err;
        busy = false;
        confirmBtn.disabled = false; cancelBtn.disabled = false;
        confirmBtn.classList.remove('btn-loading');
        confirmBtn.textContent = original;
      } else {
        root.innerHTML = '';
      }
    } catch (e) {
      errEl.textContent = e.message || 'Si è verificato un errore imprevisto.';
      busy = false;
      confirmBtn.disabled = false; cancelBtn.disabled = false;
      confirmBtn.classList.remove('btn-loading');
      confirmBtn.textContent = original;
    }
  };
}

// Disabilita/attenua un pulsante primario fuori da una modale durante un'azione
// asincrona (es. "Salva modifiche"), per evitare doppi invii da doppio tocco.
export async function withButtonLoading(button, fn) {
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('btn-loading');
  try {
    await fn();
  } finally {
    button.disabled = false;
    button.classList.remove('btn-loading');
  }
}
