import React, { useState, useEffect, useRef, useCallback } from 'react';
import { state } from '../state.js';
import { TABS, canSeeTab, isAdmin, isLinkedUser } from '../utils/permissions.js';
import { orderedSectors, sectorFullName } from '../utils/sectors.js';
import { cx, Avatar, Pannello } from './ui.jsx';
import { IconaSezione, Chevron, coloreSezione } from './icone.jsx';
import { Finestra } from './moduli.jsx';

/* Il guscio.
 *
 * Tre zone che non scorrono l'una nell'altra: testata, colonna delle sezioni,
 * contenuto. Scorre solo il contenuto — la colonna resta ferma perché è il modo
 * di cambiare sezione, e sparire proprio quando serve non è un comportamento.
 *
 * Sotto i 1024px la colonna non si rimpicciolisce: sparisce e arriva una barra
 * in basso. Il pollice arriva in basso, non in alto a sinistra.
 */

function sezioniVisibili(utente) {
  return TABS.filter(t => canSeeTab(t, utente));
}

function settoriAccessibili() {
  if (isAdmin(state.currentUser)) return orderedSectors(state.sectors);
  if (isLinkedUser(state.currentUser)) {
    return orderedSectors(state.sectors.filter(s => state.familySectorIds.includes(s.id)));
  }
  const ids = state.staffSectors[state.currentUser.id] || [];
  return orderedSectors(state.sectors.filter(s => ids.includes(s.id)));
}

/* ------------------------------------------------------- selettore categoria */
/* Due selettori diversi, non lo stesso rimpicciolito.
 *
 * Su schermo largo: un controllo segmentato con UN indicatore che scivola da
 * una voce all'altra. Prima ogni pastiglia aveva la sua ombra blu, e l'ombra
 * veniva tagliata di netto dal contenitore che scorre — quello che si vedeva
 * intorno alla scelta erano i bordi dritti del taglio. Qui l'unica cosa che si
 * muove è l'indicatore, e il movimento dice da dove a dove si è passati.
 *
 * Su telefono l'elenco non sta in alto: c'è il nome della categoria aperta, e
 * il tocco apre un foglio con tutte. Una fila che scorre nasconde metà delle
 * voci proprio a chi ha meno schermo, e le nasconde senza dirlo.
 */

function nomeSettore(s) {
  return sectorFullName(s, state.sectors);
}

function menoMovimento() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

// La spunta della voce scelta: nel foglio non c'è spazio per un indicatore che
// scivola, e un segno di scelta è quello che ci si aspetta di trovare.
function Spunta() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0 text-blu" fill="none" aria-hidden="true">
      <path d="m4.4 10.4 3.7 3.7 7.5-8.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pastiglie({ settori, attiva, onCambia }) {
  const scorrevole = useRef(null);
  const pista = useRef(null);
  const voci = useRef({});
  const [indicatore, setIndicatore] = useState(null);
  const [animato, setAnimato] = useState(false);

  useEffect(() => {
    function misura() {
      const n = voci.current[attiva];
      setIndicatore(n && n.offsetWidth ? { x: n.offsetLeft, w: n.offsetWidth } : null);
    }
    misura();
    // Il carattere può arrivare dopo il primo disegno: le larghezze cambiano
    // sotto l'indicatore senza che nessuno abbia toccato niente.
    const osservatore = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(misura) : null;
    if (osservatore && pista.current) osservatore.observe(pista.current);
    window.addEventListener('resize', misura);
    return () => {
      if (osservatore) osservatore.disconnect();
      window.removeEventListener('resize', misura);
    };
  }, [attiva, settori.length]);

  // La prima misura non si anima: all'apertura l'indicatore arriverebbe
  // scivolando da sinistra, come se qualcuno avesse appena scelto.
  useEffect(() => {
    if (!indicatore || animato) return;
    const f = requestAnimationFrame(() => setAnimato(true));
    return () => cancelAnimationFrame(f);
  }, [indicatore, animato]);

  // Con molte categorie quella scelta può restare fuori dallo schermo, e
  // l'indicatore scivolerebbe dove non si vede.
  useEffect(() => {
    const n = voci.current[attiva];
    const box = scorrevole.current;
    if (!n || !box || box.scrollWidth <= box.clientWidth) return;
    const meta = (box.clientWidth - n.offsetWidth) / 2;
    const dolce = animato && !menoMovimento();
    box.scrollTo({ left: Math.max(0, n.offsetLeft - meta), behavior: dolce ? 'smooth' : 'auto' });
  }, [attiva, animato]);

  return (
    <div
      ref={scorrevole}
      className="hidden overflow-x-auto [scrollbar-width:none] sm:block [&::-webkit-scrollbar]:hidden"
    >
      <div ref={pista} className="relative flex w-max items-center gap-0.5 rounded-full vetro orlo p-1">
        {indicatore && (
          <span
            aria-hidden="true"
            className={cx(
              'absolute inset-y-1 left-0 rounded-full bg-gradient-to-br from-blu to-blu2',
              animato && 'transition-[transform,width] duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none'
            )}
            style={{ transform: 'translateX(' + indicatore.x + 'px)', width: indicatore.w + 'px' }}
          />
        )}
        {settori.map(s => {
          const on = s.id === attiva;
          return (
            <button
              key={s.id}
              ref={n => { voci.current[s.id] = n; }}
              onClick={() => onCambia(s.id)}
              title={nomeSettore(s)}
              className={cx(
                'relative z-[1] shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors duration-200',
                s.parent_id ? 'text-[11.5px]' : 'text-[12.5px]',
                on ? 'font-bold text-white' : 'font-semibold text-soffuso hover:text-testo'
              )}
            >
              {s.parent_id && <span className={cx('mr-1', on ? 'opacity-60' : 'opacity-40')}>·</span>}
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SceltaTelefono({ settori, attiva, onCambia }) {
  const [aperto, setAperto] = useState(false);
  const corrente = settori.find(s => s.id === attiva);

  return (
    <>
      <button
        onClick={() => setAperto(true)}
        className="flex w-full items-center gap-2 rounded-full vetro orlo px-4 py-2 text-left transition-colors hover:bg-pannello/12 sm:hidden"
      >
        <span className="etichetta shrink-0">Categoria</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {corrente ? nomeSettore(corrente) : 'Scegli'}
        </span>
        <Chevron dim={14} className="shrink-0 rotate-90 text-tenue" />
      </button>

      {aperto && (
        <Finestra
          titolo="Categoria"
          sotto="Vale per rosa, allenamenti, partite e statistiche."
          onChiudi={() => setAperto(false)}
        >
          <div className="-my-2">
            {settori.map((s, i) => {
              const on = s.id === attiva;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (!on) onCambia(s.id); setAperto(false); }}
                  className={cx(
                    'flex w-full items-center gap-3 py-3.5 text-left transition-colors',
                    i > 0 && 'border-t border-bordo/8'
                  )}
                >
                  <span
                    className={cx(
                      'min-w-0 flex-1 truncate',
                      s.parent_id ? 'pl-4 text-[13.5px] text-soffuso' : 'text-[15px] font-semibold',
                      on && 'text-blu'
                    )}
                  >
                    {s.parent_id && <span className="mr-2 opacity-40">·</span>}
                    {s.name}
                  </span>
                  {on && <Spunta />}
                </button>
              );
            })}
          </div>
        </Finestra>
      )}
    </>
  );
}

function Categorie({ attiva, onCambia }) {
  const settori = settoriAccessibili();
  if (settori.length === 0) return null;
  if (settori.length === 1) {
    return <div className="etichetta">{nomeSettore(settori[0])}</div>;
  }
  return (
    <>
      <Pastiglie settori={settori} attiva={attiva} onCambia={onCambia} />
      <SceltaTelefono settori={settori} attiva={attiva} onCambia={onCambia} />
    </>
  );
}

/* ------------------------------------------------------------------ testata */
function Testata({ onSezione, sectorId, onSettore, strumenti }) {
  const squadra = state.teamProfile || {};
  const utente = state.currentUser || {};
  return (
    <header className="sticky top-0 z-30 shrink-0 vetro-alto border-b border-bordo/10">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button onClick={() => onSezione('home')} className="flex min-w-0 items-center gap-2.5 text-left">
          {/* Il simbolo di SQUAD, e accanto il nome della società. Il simbolo
              resta questo anche quando la società ha caricato il proprio logo:
              qui si dice in che applicazione si è, non con che squadra — il
              logo della società vive nei contesti sportivi. */}
          <img className="marchio-simbolo h-10 w-10 shrink-0 lg:h-11 lg:w-11" alt="SQUAD" />
          <span className="min-w-0">
            <span className="etichetta block leading-none">Squad</span>
            <span className="block truncate text-[15.5px] font-semibold leading-tight lg:text-[17px]">
              {squadra.name || 'Società'}
            </span>
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {strumenti}
          <button
            onClick={() => onSezione('profilo')}
            className="flex items-center gap-2 rounded-full vetro orlo py-1 pl-1 pr-1 sm:pr-3 transition-colors hover:bg-pannello/12"
          >
            <Avatar nome={utente.display_name} url={state.myAvatarUrl} dim={28} />
            <span className="hidden max-w-[150px] truncate text-[12.5px] font-semibold sm:block">
              {utente.display_name}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 pb-2.5 sm:px-6">
        <Categorie attiva={sectorId} onCambia={onSettore} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------- colonna a sinistra */
const NOMI_GRUPPO = { settore: 'Categoria', societa: 'Società' };

function Colonna({ sezione, onSezione }) {
  const voci = sezioniVisibili(state.currentUser);
  return (
    <nav className="hidden w-[248px] shrink-0 flex-col overflow-y-auto px-3 py-5 lg:flex">
      {['settore', 'societa'].map(g => {
        const dentro = voci.filter(v => v.group === g);
        if (dentro.length === 0) return null;
        return (
          <div key={g} className="mb-7 last:mb-0">
            <div className="etichetta px-3 pb-2.5">{NOMI_GRUPPO[g]}</div>
            <div className="space-y-1">
              {dentro.map(v => {
                const on = v.id === sezione;
                return (
                  <button
                    key={v.id}
                    onClick={() => onSezione(v.id)}
                    className={cx(
                      'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                      'text-[13.5px] transition-all duration-150',
                      on
                        ? 'vetro orlo font-bold text-testo shadow-sm'
                        : 'font-medium text-soffuso hover:bg-pannello/8 hover:text-testo'
                    )}
                  >
                    {/* L'icona a colori resta accesa anche da spenta: è
                        l'ancora che fa trovare la voce senza leggerla. */}
                    <IconaSezione id={v.id} dim={34} className={on ? '' : 'opacity-85 group-hover:opacity-100'} />
                    <span className="min-w-0 flex-1 truncate">{v.label}</span>
                    {on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blu shadow-blu" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------- barra mobile */
/* ----------------------------------------------- la barra sul telefono */
/* Un carosello continuo, non cinque caselle piu' un cassetto.
 *
 * La regola e' una sola: la voce piu' vicina al centro E' la sezione aperta.
 * Non esiste una voce speciale — Home lo sembrava solo perche' stava al centro
 * per prima, e al centro ci sta chiunque ci arrivi.
 *
 * PERCHE' L'ELENCO GIRA. Con una pista che comincia e finisce, la prima voce
 * al centro ha il vuoto alla sua sinistra e l'ultima ha il vuoto alla sua
 * destra: la barra sembra rotta proprio nei due punti in cui si apre l'app.
 * Qui l'elenco e' ripetuto tre volte e lo scorrimento si riporta di nascosto
 * nella copia di mezzo quando esce: le copie sono larghe un multiplo esatto
 * del passo, quindi i punti di aggancio coincidono e il salto non si vede.
 * Cosi' OGNI voce ha lo stesso numero di sezioni a destra e a sinistra.
 *
 * Il movimento e' lo scorrimento nativo con lo scatto e l'inerzia del sistema:
 * un carosello scritto a mano con i pointer event si riconosce sempre, perche'
 * la fisica non e' mai quella del telefono su cui gira. Quello che aggiungo io
 * e' solo la misura della distanza dal centro, che diventa --v su ogni voce.
 */

// Larghezza di una voce. Con il riempimento laterale a meta' schermo che
// mettiamo sotto, portare al centro la voce numero i vuol dire esattamente
// scrollLeft = i * PASSO: e' quello che rende semplice tutto il resto.
const PASSO = 84;
const COPIE = 3;

function BarraMobile({ sezione, onSezione }) {
  const pista = useRef(null);
  const voci = useRef({});
  const attesa = useRef(null);
  const ultimo = useRef(sezione);

  const sezioni = sezioniVisibili(state.currentUser);
  const quante = sezioni.length;
  const giro = quante * PASSO;               // larghezza di una copia

  // Tre copie di fila. La chiave porta la copia, il valore no: due voci in
  // copie diverse sono la stessa sezione.
  const catena = [];
  for (let c = 0; c < COPIE; c++) {
    sezioni.forEach((v, j) => catena.push({ v, chiave: c + '-' + v.id, indice: c * quante + j }));
  }

  const fermo = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };

  // La distanza dal centro, tradotta in --v. Si scrive direttamente nel DOM:
  // passare da uno stato React vorrebbe dire ridisegnare quarantacinque voci a
  // ogni fotogramma di scorrimento.
  const misura = useCallback(() => {
    const box = pista.current;
    if (!box) return;
    const centro = box.scrollLeft + box.clientWidth / 2;
    catena.forEach(x => {
      const el = voci.current[x.chiave];
      if (!el) return;
      const suo = el.offsetLeft + el.offsetWidth / 2;
      // La sfumatura si estende oltre il singolo posto: le voci accanto stanno
      // a meta' strada invece di essere spente come quelle lontane, ed e'
      // quello che fa sembrare la barra una cosa sola che si muove.
      const d = Math.min(Math.abs(suo - centro) / (PASSO * 1.7), 1);
      const t = 1 - d;
      el.style.setProperty('--v', (t * t * (3 - 2 * t)).toFixed(3));
    });
  }, [quante]);

  // Il rientro nella copia di mezzo. Distanza esatta di un giro, quindi lo
  // scatto resta agganciato dov'era e il salto non si percepisce.
  function rientra() {
    const box = pista.current;
    if (!box || !giro) return;
    if (box.scrollLeft < giro * 0.5) box.scrollLeft += giro;
    else if (box.scrollLeft > giro * 1.5) box.scrollLeft -= giro;
  }

  // Porta una sezione al centro scegliendo la copia piu' vicina: se la voce
  // sta a un passo alla mia sinistra, non deve attraversare tutto l'elenco per
  // arrivare al centro.
  function porta(id, morbido) {
    const box = pista.current;
    if (!box) return;
    const j = sezioni.findIndex(x => x.id === id);
    if (j < 0) return;
    const ora = box.scrollLeft;
    let meta = null;
    for (let c = 0; c < COPIE; c++) {
      const cand = (c * quante + j) * PASSO;
      if (meta === null || Math.abs(cand - ora) < Math.abs(meta - ora)) meta = cand;
    }
    box.scrollTo({ left: meta, behavior: morbido && !fermo() ? 'smooth' : 'auto' });
  }

  // All'apertura ci si posiziona nella copia di mezzo, sulla sezione aperta.
  useEffect(() => {
    const box = pista.current;
    if (!box) return;
    const j = sezioni.findIndex(x => x.id === sezione);
    box.scrollLeft = ((j < 0 ? 0 : j) + quante) * PASSO;
    misura();
    const t = setTimeout(misura, 60);      // dopo che il carattere ha misurato
    return () => clearTimeout(t);
  }, []);

  // Quando la sezione cambia da fuori — un pannello della Home, per dire — la
  // voce aperta si porta al centro.
  useEffect(() => {
    if (ultimo.current === sezione) return;
    ultimo.current = sezione;
    porta(sezione, true);
  }, [sezione]);

  useEffect(() => {
    window.addEventListener('resize', misura);
    return () => window.removeEventListener('resize', misura);
  }, [misura]);

  // Fine dello scorrimento: si guarda chi e' rimasto al centro e si apre quella
  // sezione. `scrollend` non c'e' ovunque, quindi il ritardo fa da rete.
  function fineScorrimento() {
    const box = pista.current;
    if (!box) return;
    rientra();
    const centro = box.scrollLeft + box.clientWidth / 2;
    let vicina = null, minima = Infinity;
    catena.forEach(x => {
      const el = voci.current[x.chiave];
      if (!el) return;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centro);
      if (d < minima) { minima = d; vicina = x.v.id; }
    });
    if (vicina && vicina !== sezione) { ultimo.current = vicina; onSezione(vicina); }
  }

  function scorre() {
    misura();
    clearTimeout(attesa.current);
    attesa.current = setTimeout(fineScorrimento, 140);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 lg:hidden" aria-label="Sezioni">
      {/* La superficie sta DIETRO le voci e non le contiene: un contenitore che
          scorre in orizzontale ritaglia anche in verticale, e l'oggetto
          sollevato verrebbe tagliato a meta' proprio mentre esce. */}
      <div
        aria-hidden="true"
        className="barra-superficie absolute inset-x-0 bottom-0 top-[2rem] vetro-alto"
      />

      {/* La linea di confine, che al centro scende a formare la conca e passa
          SOTTO la voce sollevata.

          Tre pezzi che si toccano, non un tratto lungo con una toppa sopra:
          il dritto a sinistra, il semicerchio, il dritto a destra. La prima
          versione tirava la linea per tutta la larghezza e copriva il pezzo
          dentro la conca con una pennellata del colore del pannello — che in
          tema chiaro non e' esattamente il colore della barra, e infatti si
          vedeva. Qui non c'e' niente da coprire. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[2rem] h-px bg-bordo/40"
        style={{ right: 'calc(50% + 60px)' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-[2rem] h-px bg-bordo/40"
        style={{ left: 'calc(50% + 60px)' }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[2rem] h-[2.2rem] w-[7.5rem] -translate-x-1/2 -translate-y-px"
        viewBox="0 0 120 35"
        fill="none"
      >
        {/* Raggio 28 contro un disco che al centro ne misura 20: otto pixel di
            margine tutt'intorno. E' quel margine a far sembrare che la barra si
            sia aperta per far passare l'oggetto, invece che l'oggetto appoggiato
            sopra una curva disegnata. */}
        <path d="M0 1H32A28 28 0 0 0 88 1H120" stroke="rgb(var(--bordo) / 0.4)" strokeWidth="1.5" />
      </svg>

      <div
        ref={pista}
        onScroll={scorre}
        className="barra-pista relative flex overflow-x-auto pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-2"
        style={{ paddingLeft: 'calc(50% - ' + (PASSO / 2) + 'px)', paddingRight: 'calc(50% - ' + (PASSO / 2) + 'px)' }}
      >
        {catena.map(x => {
          const aperta = x.v.id === sezione;
          return (
            <button
              key={x.chiave}
              ref={n => { voci.current[x.chiave] = n; }}
              onClick={() => { porta(x.v.id, true); if (!aperta) onSezione(x.v.id); }}
              onFocus={() => porta(x.v.id, true)}
              aria-current={aperta ? 'page' : undefined}
              style={{ width: PASSO + 'px' }}
              className="barra-voce relative flex shrink-0 flex-col items-center gap-1.5 px-1 pb-1 pt-1"
            >
              <span className="relative grid h-[4.6rem] w-full place-items-end justify-items-center pb-0.5">
                <IconaSezione id={x.v.id} dim={48} className="barra-figura relative" />
              </span>
              <span className="barra-etichetta w-full truncate text-center text-[9px] font-bold uppercase tracking-[0.06em]">
                {x.v.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Guscio({ sezione, onSezione, sectorId, onSettore, nastro, strumenti, children }) {
  useEffect(() => {
    const el = document.getElementById('contenuto');
    if (el) el.scrollTop = 0;
  }, [sezione, sectorId]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {nastro}
      <Testata onSezione={onSezione} sectorId={sectorId} onSettore={onSettore} strumenti={strumenti} />
      <div className="flex min-h-0 flex-1">
        <Colonna sezione={sezione} onSezione={onSezione} />
        <main id="contenuto" className="min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-7 lg:pb-12 lg:pr-8">
          <div className="mx-auto w-full max-w-[1120px] animate-salita">{children}</div>
        </main>
      </div>
      <BarraMobile sezione={sezione} onSezione={onSezione} />
    </div>
  );
}
