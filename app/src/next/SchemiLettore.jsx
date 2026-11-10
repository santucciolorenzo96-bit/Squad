import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  normalizzaSchema, sequenza, istante, durataTotale, inizioPasso, durataPasso,
  frecce, statoDopo
} from '../utils/schemi.js';
import { SchemiCampo, COLORI_CAMPO } from './SchemiCampo.jsx';
import { Pulsante, Stato, cx } from './ui.jsx';

/* IL LETTORE: dove l'atleta rivede lo schema.
 *
 * Parte da solo — chi apre uno schema vuole vederlo muoversi — e poi si
 * governa con quello che serve a studiarlo: pausa, rallentatore, passo per
 * passo, e una barra del tempo per tornare in un punto preciso. «Piu` piano» e`
 * la cosa che un video non sa fare, ed e` il motivo per cui questa e` una
 * animazione.
 *
 * L'orologio e` UNO, `t`, in millisecondi dall'inizio. Il fotogramma si ricalcola
 * da lui a ogni istante (`istante()`), quindi la barra del tempo, i tasti
 * «passo avanti» e l'animazione che corre sono la stessa cosa vista da punti
 * diversi: nessuno stato da tenere allineato.
 */

function Icona({ d, dim = 20 }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONE = {
  play: 'M8 5.5v13a.9.9 0 0 0 1.4.75l10-6.5a.9.9 0 0 0 0-1.5l-10-6.5A.9.9 0 0 0 8 5.5Z',
  pausa: 'M7 5h3.4v14H7zM13.6 5H17v14h-3.4z',
  precedente: 'M6 5h2.4v14H6zM9.8 12l9.2-6.6v13.2z',
  successivo: 'M15.6 5H18v14h-2.4zM5 5.4 14.2 12 5 18.6z',
  ricomincia: 'M12 5a7 7 0 1 1-6.6 9.3 1 1 0 1 1 1.9-.6A5 5 0 1 0 12 7H9.8l1.6 1.6a1 1 0 0 1-1.4 1.4L6.3 6.3a1 1 0 0 1 0-1.4L10 1.2a1 1 0 1 1 1.4 1.4L9.8 5H12Z'
};

const VELOCITA = [
  { v: 1, testo: '1×' },
  { v: 0.5, testo: '½×' },
  { v: 0.25, testo: '¼×' }
];

function menoMovimento() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/* La legenda: cosa significa ogni linea. Chi legge uno schema per la prima volta
 * non puo` indovinare che l'ondulata e` il palleggio. */
function Legenda() {
  const voce = (colore, tratteggio, onda, testo) => (
    <span className="inline-flex items-center gap-1.5">
      <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">
        {onda
          ? <path d="M1 5 Q4 0 7 5 T13 5 T19 5 T25 5" fill="none" stroke={colore} strokeWidth="1.8" strokeLinecap="round" />
          : <line x1="1" y1="5" x2="25" y2="5" stroke={colore} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={tratteggio ? '4 3' : undefined} />}
      </svg>
      {testo}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-tenue">
      {voce(COLORI_CAMPO.taglio, false, false, 'Taglio')}
      {voce(COLORI_CAMPO.palleggio, false, true, 'Palleggio')}
      {voce(COLORI_CAMPO.blocco, false, false, 'Blocco')}
      {voce(COLORI_CAMPO.passaggio, true, false, 'Passaggio')}
    </div>
  );
}

export function SchemaLettore({ play, onChiudi, onModifica, anteprima = false }) {
  const schema = useMemo(() => normalizzaSchema(play.data), [play.data]);
  const [varianteId, setVarianteId] = useState(null);
  const steps = useMemo(() => sequenza(schema, varianteId), [schema, varianteId]);
  const durata = durataTotale(steps);

  const [t, setT] = useState(0);
  const [inCorso, setInCorso] = useState(() => !menoMovimento());
  const [vel, setVel] = useState(1);
  const [ripeti, setRipeti] = useState(false);

  // Cambiare sequenza riparte dall'inizio: la posizione di prima non vuol dire niente.
  useEffect(() => {
    setT(0);
    setInCorso(!menoMovimento());
  }, [varianteId]);

  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tasto);
      document.body.style.overflow = prima;
    };
  }, [onChiudi]);

  /* L'ORLOGIO. `requestAnimationFrame` dice quando, non quanto: il tempo che
     passa si misura fra un fotogramma e l'altro. Un tetto a 100 ms: se la
     scheda e` stata in secondo piano, il primo fotogramma al ritorno non deve
     saltare tre secondi di animazione. */
  useEffect(() => {
    if (!inCorso || durata <= 0) return undefined;
    let raf;
    let ultimo = performance.now();
    const tic = (ora) => {
      const dt = Math.min(ora - ultimo, 100);
      ultimo = ora;
      setT(prec => Math.min(prec + dt * vel, durata));
      raf = requestAnimationFrame(tic);
    };
    raf = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(raf);
  }, [inCorso, vel, durata]);

  useEffect(() => {
    if (inCorso && durata > 0 && t >= durata) {
      if (ripeti) setT(0);
      else setInCorso(false);
    }
  }, [t, inCorso, durata, ripeti]);

  const f = istante(schema.start, steps, t);
  // All'istante zero si e` ancora alla posizione di partenza, non dentro il primo passo.
  const attivo = steps.length === 0 || t < 40 ? -1 : f.passo;
  const fr = attivo >= 0 ? frecce(schema.start, steps, attivo) : { movimenti: [], passaggio: null };
  const prima = attivo >= 0 ? statoDopo(schema.start, steps, attivo).pos : null;
  const fantasmi = prima ? Object.fromEntries(fr.movimenti.map(m => [m.id, prima[m.id]])) : null;

  const variante = varianteId ? schema.varianti.find(v => v.id === varianteId) : null;
  const nota = attivo >= 0 ? (steps[attivo] && steps[attivo].nota) : '';

  function vaiAlPasso(k) {
    setInCorso(false);
    if (k < 0) { setT(0); return; }
    setT(inizioPasso(steps, k) + durataPasso(steps[k]));
  }

  function suGiu() {
    if (inCorso) { setInCorso(false); return; }
    if (t >= durata) setT(0);
    setInCorso(true);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-fondo">
      <div className="margine-notch shrink-0 border-b border-bordo/10 vetro-alto">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={onChiudi}
            className="-ml-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo"
          >
            ← Chiudi
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[15px] font-bold leading-tight">{play.title || 'Senza nome'}</div>
          </div>
          {onModifica
            ? <Pulsante className="py-1.5 text-[12.5px]" onClick={onModifica}>Modifica</Pulsante>
            : <span className="w-16" />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[56rem] px-4 pb-10 pt-4 sm:px-6">
          {anteprima && (
            <div className="mb-3"><Stato tono="attesa">Anteprima: non è ancora salvato</Stato></div>
          )}

          {(play.labels || []).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {play.labels.map(e => (
                <span key={e} className="rounded-full bg-pannello/12 px-2.5 py-1 text-[12px] font-semibold text-soffuso">{e}</span>
              ))}
            </div>
          )}

          {schema.varianti.length > 0 && (
            <div className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-1.5">
                {[{ id: null, nome: 'Schema base' }, ...schema.varianti].map(v => {
                  const on = v.id === varianteId;
                  return (
                    <button
                      key={v.id || 'base'}
                      onClick={() => setVarianteId(v.id)}
                      aria-pressed={on}
                      className={cx(
                        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-150',
                        on ? 'vivo font-bold text-white' : 'vetro orlo font-semibold text-soffuso hover:text-testo'
                      )}
                    >
                      {v.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {variante && variante.condizione && (
            <div className="mb-3 rounded-lg bg-ambra/10 px-3.5 py-2.5 text-[13px] leading-relaxed">
              <span className="font-bold text-ambra">Quando: </span>{variante.condizione}
            </div>
          )}

          <div className="overflow-hidden rounded-xl orlo">
            <SchemiCampo
              pos={f.pos}
              palla={f.palla}
              movimenti={fr.movimenti}
              passaggio={fr.passaggio}
              fantasmi={fantasmi}
            />
          </div>

          {/* La didascalia del passo: e` quello che l'allenatore direbbe a voce. */}
          <div className="mt-3 min-h-[3.25rem] rounded-lg bg-pannello/8 px-3.5 py-2.5">
            {steps.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-tenue">
                Questo schema mostra solo la posizione di partenza.
              </p>
            ) : attivo < 0 ? (
              <p className="text-[13px] leading-relaxed text-tenue">
                <b className="text-testo">Posizione di partenza.</b> Premi play, oppure scegli un passo qui sotto.
              </p>
            ) : (
              <p className="text-[13.5px] leading-relaxed">
                <b className="cifra mr-1.5 text-tenue">Passo {attivo + 1} di {steps.length}</b>
                {nota || <span className="text-tenue">—</span>}
              </p>
            )}
          </div>

          {/* La barra del tempo. */}
          {durata > 0 && (
            <input
              type="range"
              min="0"
              max={durata}
              step="10"
              value={Math.round(t)}
              onChange={e => { setInCorso(false); setT(Number(e.target.value)); }}
              aria-label="Posizione nell'animazione"
              className="mt-4 h-2 w-full cursor-pointer accent-[rgb(var(--blu))]"
            />
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => vaiAlPasso(attivo - 1)}
                disabled={steps.length === 0 || attivo < 0}
                aria-label="Passo precedente"
                className="grid h-11 w-11 place-items-center rounded-full vetro orlo text-soffuso transition-colors hover:text-testo disabled:opacity-35"
              >
                <Icona d={ICONE.precedente} />
              </button>
              <button
                onClick={suGiu}
                disabled={steps.length === 0}
                aria-label={inCorso ? 'Pausa' : 'Riproduci'}
                className="vivo grid h-14 w-14 place-items-center rounded-full text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-35"
              >
                <Icona d={inCorso ? ICONE.pausa : ICONE.play} dim={24} />
              </button>
              <button
                onClick={() => vaiAlPasso(Math.min(attivo + 1, steps.length - 1))}
                disabled={steps.length === 0 || attivo >= steps.length - 1}
                aria-label="Passo successivo"
                className="grid h-11 w-11 place-items-center rounded-full vetro orlo text-soffuso transition-colors hover:text-testo disabled:opacity-35"
              >
                <Icona d={ICONE.successivo} />
              </button>
              <button
                onClick={() => { setT(0); setInCorso(false); }}
                disabled={steps.length === 0}
                aria-label="Ricomincia"
                className="grid h-11 w-11 place-items-center rounded-full vetro orlo text-soffuso transition-colors hover:text-testo disabled:opacity-35"
              >
                <Icona d={ICONE.ricomincia} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex gap-1 rounded-full vetro orlo p-1" role="group" aria-label="Velocità">
                {VELOCITA.map(x => (
                  <button
                    key={x.v}
                    onClick={() => setVel(x.v)}
                    aria-pressed={vel === x.v}
                    className={cx(
                      'cifra rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all duration-150',
                      vel === x.v ? 'vivo text-white' : 'text-tenue hover:text-testo'
                    )}
                  >
                    {x.testo}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setRipeti(r => !r)}
                aria-pressed={ripeti}
                className={cx(
                  'rounded-full px-3 py-2 text-[13px] font-semibold transition-all duration-150',
                  ripeti ? 'vivo text-white' : 'vetro orlo text-tenue hover:text-testo'
                )}
              >
                Ripeti
              </button>
            </div>
          </div>

          {steps.length > 0 && (
            <div className="mt-4">
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max items-center gap-1.5">
                  {[-1, ...steps.map((_, i) => i)].map(k => {
                    const on = k === attivo;
                    return (
                      <button
                        key={k}
                        onClick={() => vaiAlPasso(k)}
                        aria-pressed={on}
                        className={cx(
                          'cifra whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-150',
                          on ? 'vivo font-bold text-white' : 'vetro orlo font-semibold text-soffuso hover:text-testo'
                        )}
                      >
                        {k < 0 ? 'Inizio' : k + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5"><Legenda /></div>

          {play.note && (
            <p className="mt-5 whitespace-pre-line text-[13.5px] leading-relaxed text-soffuso">{play.note}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
