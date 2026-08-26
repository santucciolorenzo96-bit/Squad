import { esc } from '../utils/format.js';

export function openPhotoPositionModal(url, initialX, initialY, onSave) {
  const root = document.getElementById('modalRoot');
  let posX = initialX ?? 50, posY = initialY ?? 50;
  root.innerHTML = `<div class="modal-overlay" id="ppOverlay"><div class="modal-box">
    <h3>Inquadra la foto</h3>
    <p>Trascina la foto per scegliere la parte visibile nelle anteprime.</p>
    <div class="photo-crop-frame" id="ppFrame"><img id="ppImg" src="${esc(url)}" style="object-position:${posX}% ${posY}%;" draggable="false"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="ppCancel">Annulla</button>
      <button class="btn btn-primary" id="ppSave" style="width:auto;">Conferma</button>
    </div>
  </div></div>`;

  const frame = document.getElementById('ppFrame');
  const img = document.getElementById('ppImg');
  let dragging = false, startX = 0, startY = 0, startPosX = posX, startPosY = posY;

  const point = (e) => e.touches ? e.touches[0] : e;
  const onDown = (e) => {
    dragging = true;
    const pt = point(e);
    startX = pt.clientX; startY = pt.clientY; startPosX = posX; startPosY = posY;
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const pt = point(e);
    const rect = frame.getBoundingClientRect();
    const dx = pt.clientX - startX, dy = pt.clientY - startY;
    posX = Math.min(100, Math.max(0, startPosX - (dx / rect.width) * 150));
    posY = Math.min(100, Math.max(0, startPosY - (dy / rect.height) * 150));
    img.style.objectPosition = `${posX}% ${posY}%`;
  };
  const onUp = () => { dragging = false; };

  frame.addEventListener('mousedown', onDown);
  frame.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  function cleanup() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
  }
  document.getElementById('ppCancel').onclick = () => { cleanup(); root.innerHTML = ''; };
  document.getElementById('ppOverlay').onclick = (e) => { if (e.target.id === 'ppOverlay') { cleanup(); root.innerHTML = ''; } };
  document.getElementById('ppSave').onclick = async () => {
    cleanup();
    root.innerHTML = '';
    await onSave(posX, posY);
  };
}
