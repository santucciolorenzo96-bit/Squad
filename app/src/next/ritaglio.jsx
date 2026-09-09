import React, { useEffect, useRef, useState } from 'react';
import { Finestra } from './moduli.jsx';
import { Etichetta, Pulsante, cx } from './ui.jsx';

/* Scelta del punto di interesse di una fotografia.
 *
 * Non è un ritaglio: l'immagine viene salvata intera, e quello che si sceglie
 * qui è QUALE PUNTO resta al centro quando la si mostra dentro un cerchio. È
 * una differenza che conta — ritagliando si perde per sempre il resto della
 * foto, e la stessa immagine serve sia dentro un cerchio da 28 pixel sia
 * dentro uno da 92.
 *
 * Il punto si trascina, non si imposta con due cursori: guardando il risultato
 * si capisce in un attimo se il viso è centrato, e con due numeri no.
 */

export function ScegliCentro({ file, url, iniziale, tondo = true, onChiudi, onConferma }) {
  const [sorgente, setSorgente] = useState(url || null);
  const [punto, setPunto] = useState(iniziale || { x: 50, y: 50 });
  const [trascina, setTrascina] = useState(false);
  const area = useRef(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setSorgente(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function daEvento(e) {
    const r = area.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPunto({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  }

  return (
    <Finestra
      titolo="Scegli il punto da centrare"
      sotto="Trascina sul viso. L’immagine resta intera: cambia solo cosa si vede quando è piccola."
      onChiudi={onChiudi}
      azioni={
        <div className="flex justify-end gap-2">
          <Pulsante variante="nudo" onClick={onChiudi}>Annulla</Pulsante>
          <Pulsante variante="primario" onClick={() => onConferma(punto)}>Usa questo punto</Pulsante>
        </div>
      }
    >
      {sorgente ? (
        <>
          <div
            ref={area}
            onPointerDown={(e) => { setTrascina(true); e.currentTarget.setPointerCapture(e.pointerId); daEvento(e); }}
            onPointerMove={(e) => { if (trascina) daEvento(e); }}
            onPointerUp={() => setTrascina(false)}
            onPointerCancel={() => setTrascina(false)}
            className="relative mx-auto max-h-[46dvh] w-full cursor-crosshair touch-none overflow-hidden rounded-lg orlo"
          >
            <img src={sorgente} alt="" className="block max-h-[46dvh] w-full object-contain" draggable="false" />

            {/* Il mirino, non un semplice puntino: si deve vedere sopra
                qualunque fotografia, chiara o scura che sia. */}
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: punto.x + '%', top: punto.y + '%' }}
            >
              <span className="block h-9 w-9 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.45)]" />
            </span>
          </div>

          <div className="mt-5">
            <Etichetta className="mb-2.5">Come si vedrà</Etichetta>
            <div className="flex items-end gap-4">
              {[92, 44, 28].map(d => (
                <div key={d} className="text-center">
                  <span
                    className={cx('block overflow-hidden orlo', tondo ? 'rounded-full' : 'rounded-lg')}
                    style={{
                      width: d, height: d,
                      backgroundImage: `url(${sorgente})`,
                      backgroundSize: 'cover',
                      backgroundPosition: `${punto.x}% ${punto.y}%`
                    }}
                  />
                  <span className="mt-1.5 block text-[10px] text-tenue">{d}px</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
              Le tre misure sono quelle in cui compare davvero: nella scheda, negli elenchi e
              nella testata. Se il viso sta dentro tutte e tre, va bene.
            </p>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-tenue">Nessuna immagine.</p>
      )}
    </Finestra>
  );
}
