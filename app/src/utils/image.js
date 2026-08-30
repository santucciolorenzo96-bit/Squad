function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function scaledCanvas(img, maxDim) {
  let w = img.width, h = img.height;
  if (w >= h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; } }
  else { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; } }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c;
}

function toBlob(canvas, format) {
  return new Promise(resolve => {
    if (format === 'png') canvas.toBlob(b => resolve(b), 'image/png');
    else canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85);
  });
}

/**
 * Ridimensiona un'immagine.
 * `format`: 'jpeg' per le foto (più leggero), 'png' per i loghi — il JPEG non
 * ha canale alfa, quindi salvare un logo in JPEG ne appiattisce la trasparenza
 * su un fondo pieno, che è esattamente il riquadro che si vuole evitare.
 */
export async function resizeImageFile(file, maxDim, { format = 'jpeg' } = {}) {
  const img = await loadImage(file);
  return toBlob(scaledCanvas(img, maxDim), format);
}

/** Vero se l'immagine ha già pixel non completamente opachi. */
export async function imageHasAlpha(file) {
  const img = await loadImage(file);
  const c = scaledCanvas(img, 160);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/**
 * Rende trasparente lo sfondo di un logo: parte dai bordi e propaga finché i
 * pixel restano simili al colore degli angoli, così tocca solo il fondo che
 * circonda il marchio e non eventuali aree dello stesso colore al suo interno.
 * Due soglie danno un bordo morbido invece che seghettato.
 */
export async function resizeLogoWithTransparency(file, maxDim, { hard = 34, soft = 76 } = {}) {
  const img = await loadImage(file);
  const c = scaledCanvas(img, maxDim);
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const imgData = ctx.getImageData(0, 0, W, H);
  const p = imgData.data;

  const at = (x, y) => (y * W + x) * 4;
  // colore di fondo: mediana dei quattro angoli, robusta se uno è sporco
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => {
    const i = at(x, y); return [p[i], p[i + 1], p[i + 2]];
  });
  const med = k => corners.map(c2 => c2[k]).sort((a, b) => a - b)[1];
  const bg = [med(0), med(1), med(2)];
  const dist = i => Math.sqrt((p[i] - bg[0]) ** 2 + (p[i + 1] - bg[1]) ** 2 + (p[i + 2] - bg[2]) ** 2);

  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const n = y * W + x;
    if (seen[n]) return;
    seen[n] = 1;
    if (dist(n * 4) < soft) stack.push(n);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }

  while (stack.length) {
    const n = stack.pop();
    const i = n * 4;
    const d = dist(i);
    if (d <= hard) {
      p[i + 3] = 0;
    } else {
      // fascia di transizione: sbiadisce invece di tagliare di netto, e scontando
      // il fondo dal colore evita l'alone chiaro sul contorno del marchio
      const a = Math.min(1, (d - hard) / (soft - hard));
      p[i] = Math.max(0, Math.min(255, (p[i] - (1 - a) * bg[0]) / a));
      p[i + 1] = Math.max(0, Math.min(255, (p[i + 1] - (1 - a) * bg[1]) / a));
      p[i + 2] = Math.max(0, Math.min(255, (p[i + 2] - (1 - a) * bg[2]) / a));
      p[i + 3] = Math.round(255 * a);
      continue; // non propaga oltre il bordo del soggetto
    }
    const x = n % W, y = (n / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }

  // Il contorno antialiasato del marchio è una fusione col fondo: troppo diverso
  // dal fondo per essere rimosso, troppo chiaro per non lasciare un alone.
  // Si ritira il bordo di un pixel, che è la larghezza tipica di quella fusione.
  const alphaCopy = new Uint8ClampedArray(W * H);
  for (let n = 0; n < W * H; n++) alphaCopy[n] = p[n * 4 + 3];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      if (!alphaCopy[n]) continue;
      const edge =
        (x > 0 && !alphaCopy[n - 1]) || (x < W - 1 && !alphaCopy[n + 1]) ||
        (y > 0 && !alphaCopy[n - W]) || (y < H - 1 && !alphaCopy[n + W]);
      if (edge) p[n * 4 + 3] = Math.round(alphaCopy[n] * 0.25);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return toBlob(c, 'png');
}
