import { esc } from '../utils/format.js';

export function avatarHtml(player, url, size = 36) {
  const initials = (player.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (url) {
    const fx = player.photo_focal_x ?? 50, fy = player.photo_focal_y ?? 50;
    return `<div class="mini-avatar" data-photo-id="${player.id}" style="width:${size}px;height:${size}px;"><img src="${esc(url)}" style="object-position:${fx}% ${fy}%;"></div>`;
  }
  return `<div class="mini-avatar fallback" style="width:${size}px;height:${size}px;font-size:${Math.max(9, size * 0.3)}px;">${esc(initials)}</div>`;
}

export function wireAvatarClicks(container, photoUrlMap) {
  container.querySelectorAll('[data-photo-id]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const url = photoUrlMap[el.getAttribute('data-photo-id')];
      if (url) openPhotoViewModal(url);
    };
  });
}

export function openPhotoViewModal(url) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="photoViewOverlay"><div class="photo-view-box"><img src="${esc(url)}"></div></div>`;
  document.getElementById('photoViewOverlay').onclick = () => { root.innerHTML = ''; };
}
