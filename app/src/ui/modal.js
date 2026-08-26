import { esc } from '../utils/format.js';

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1700);
}

export function confirmModal(title, body, onConfirm, confirmLabel) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box">
    <h3>${esc(title)}</h3><p>${esc(body)}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalCancel">Annulla</button>
      <button class="btn btn-primary" id="modalConfirm" style="width:auto;">${esc(confirmLabel || 'Conferma')}</button>
    </div></div></div>`;
  document.getElementById('modalCancel').onclick = () => { root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') root.innerHTML = ''; };
  document.getElementById('modalConfirm').onclick = () => { root.innerHTML = ''; onConfirm(); };
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
  document.getElementById('modalCancel').onclick = () => { root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') root.innerHTML = ''; };
  document.getElementById('modalConfirm').onclick = async () => {
    const err = await onSubmit();
    if (err) { document.getElementById('modalError').textContent = err; }
    else { root.innerHTML = ''; }
  };
}
