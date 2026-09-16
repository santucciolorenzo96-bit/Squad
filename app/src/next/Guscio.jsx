import React, { useState, useEffect, useRef } from 'react';
import { state } from '../state.js';
import { TABS, canSeeTab, isAdmin, isLinkedUser, macroConVoci, macroDiSezione } from '../utils/permissions.js';
import { currentSport } from '../utils/sports/index.js';
import { orderedSectors, sectorFullName, sectorIdsFor } from '../utils/sectors.js';
import { cx, Avatar, Pannello } from './ui.jsx';
import { IconaSezione, Chevron, coloreSezione, tintaSezione } from './icone.jsx';
import { Finestra } from './moduli.jsx';
import { Campanella } from './Notifiche.jsx';

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
  // Senza tabellino dal vivo la voce Partita non ha niente da mostrare: nel
  // calcio apriva una schermata che diceva solo di non esistere.
  const sport = currentSport();
  return TABS
    .filter(t => canSeeTab(t, utente))
    .filter(t => t.id !== 'partita' || sport.match.liveTracker);
}

function gruppiVisibili(utente) {
  return macroConVoci(sezioniVisibili(utente));
}

/* Dove si era rimasti dentro ogni macro.
 *
 * Toccando «Partite» si torna alla voce che si stava guardando, non sempre alla
 * prima: chi passa la sera sulle statistiche non vuole ripartire dal calendario
 * a ogni giro. Vive quanto la scheda aperta — e' una comodita', non un dato. */
const ultimaDi = {};

function primaDi(g) {
  const ricordata = ultimaDi[g.id];
  return (ricordata && g.voci.some(v => v.id === ricordata)) ? ricordata : g.voci[0].id;
}

function settoriAccessibili() {
  const ids = sectorIdsFor(state.currentUser, {
    staffSectors: state.staffSectors,
    familySectorIds: state.familySectorIds,
    sectors: state.sectors
  });
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
              'absolute inset-y-1 left-0 rounded-full vivo',
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
                s.parent_id ? 'text-[12.5px]' : 'text-[12.5px]',
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
          {/* La campanella era rimasta fuori dal ridisegno: il database
              continuava a scrivere le notifiche e nessuno poteva leggerle. */}
          <Campanella onSezione={onSezione} />
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
/* Cinque voci, non quindici.
 *
 * Aperta resta solo la macro in cui si sta: le altre restano una riga sola. Un
 * accordion che tiene aperto tutto non ha raggruppato niente — ha solo aggiunto
 * dei titoli a un elenco lungo uguale.
 *
 * Le macro con una voce sola non si aprono: sarebbero un cassetto con dentro
 * il proprio nome.
 */
function Colonna({ sezione, onSezione }) {
  const gruppi = gruppiVisibili(state.currentUser);
  const attiva = macroDiSezione(sezione);

  return (
    <nav className="hidden w-[13.5rem] shrink-0 flex-col overflow-y-auto px-3 py-5 md:flex lg:w-[248px]" aria-label="Sezioni">
      <div className="space-y-1">
        {gruppi.map(g => {
          const sola = g.voci.length === 1;
          const aperta = attiva === g.id;
          const suo = sola && g.voci[0].id === sezione;
          return (
            <div key={g.id}>
              <button
                onClick={() => onSezione(primaDi(g))}
                aria-expanded={sola ? undefined : aperta}
                className={cx(
                  'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                  'text-[13.5px] transition-all duration-150',
                  (suo || (aperta && !sola))
                    ? 'vetro orlo font-bold text-testo shadow-sm'
                    : 'font-medium text-soffuso hover:bg-pannello/8 hover:text-testo'
                )}
              >
                {/* L'icona a colori resta accesa anche da spenta: e'
                    l'ancora che fa trovare la voce senza leggerla. */}
                <IconaSezione id={g.icona} dim={34} className={aperta || suo ? '' : 'opacity-85 group-hover:opacity-100'} />
                <span className="min-w-0 flex-1 truncate">{sola ? g.voci[0].label : g.label}</span>
                {sola
                  ? (suo && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blu shadow-blu" />)
                  : <Chevron dim={14} className={cx('shrink-0 text-tenue transition-transform duration-200', aperta && 'rotate-90')} />}
              </button>

              {/* Le sottosezioni stanno sotto il nome della macro, non sotto la
                  sua icona: il filo verticale a sinistra dice dove finisce il
                  gruppo senza bisogno di una cornice. */}
              {!sola && aperta && (
                <div className="ml-[1.55rem] mt-1 space-y-0.5 border-l border-bordo/15 pl-2.5">
                  {g.voci.map(v => {
                    const on = v.id === sezione;
                    return (
                      <button
                        key={v.id}
                        onClick={() => onSezione(v.id)}
                        aria-current={on ? 'page' : undefined}
                        className={cx(
                          'flex w-full items-center gap-2 rounded-md px-2.5 py-[0.44rem] text-left text-[12.5px] transition-all duration-150',
                          on ? 'bg-pannello/10 font-bold text-testo' : 'font-medium text-tenue hover:bg-pannello/7 hover:text-soffuso'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{v.label}</span>
                        {on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blu shadow-blu" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/* --------------------------------------------------- le sottosezioni, sul telefono */
/* Sul telefono la barra in basso porta alla macro; le sue voci stanno in cima
 * al contenuto, in fila. Non e' una seconda barra di navigazione: e' il
 * sommario di dove si e' arrivati, e sparisce dove non c'e' niente da
 * scegliere. Su schermo largo non serve — la colonna mostra gia' tutto. */
function SottoBarra({ sezione, onSezione }) {
  const pista = useRef(null);
  const attivo = useRef(null);

  // Con cinque voci l'ultima resta fuori: se e' quella aperta, la fila
  // sembrerebbe indicare qualcos'altro.
  useEffect(() => {
    const n = attivo.current, box = pista.current;
    if (!n || !box || box.scrollWidth <= box.clientWidth) return;
    const meta = (box.clientWidth - n.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, n.offsetLeft - meta), behavior: menoMovimento() ? 'auto' : 'smooth' });
  }, [sezione]);

  const gruppi = gruppiVisibili(state.currentUser);
  const g = gruppi.find(x => x.voci.some(v => v.id === sezione));
  if (!g || g.voci.length < 2) return null;
  return (
    <div ref={pista} className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max items-center gap-1.5">
        {g.voci.map(v => {
          const on = v.id === sezione;
          return (
            <button
              key={v.id}
              ref={n => { if (on) attivo.current = n; }}
              onClick={() => onSezione(v.id)}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-150',
                on
                  ? 'vivo font-bold text-white'
                  : 'vetro orlo font-semibold text-soffuso hover:text-testo'
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- barra mobile */
/* Cinque caselle ferme, e basta.
 *
 * Il carosello serviva quando le voci erano dodici: girava perche' non ci
 * stavano. Adesso sono cinque e ci stanno tutte, e allora ogni ragione per
 * farlo scorrere e' sparita — ne restavano solo gli effetti collaterali. Una
 * barra che si muove sotto il dito e' una barra dove si puo' sbagliare tocco,
 * dove la voce che cercavi non e' dove l'avevi lasciata, e dove per capire
 * cos'e' aperto bisogna guardare cosa e' finito al centro.
 *
 * Ferma, ogni sezione ha il SUO posto: si impara dove sta e ci si arriva senza
 * guardare. E' la differenza fra un menu e un nastro trasportatore.
 *
 * HOME STA IN MEZZO. Non e' simmetria: e' il posto dove arriva il pollice
 * quando si prende il telefono, ed e' la voce da cui si riparte.
 *
 * IL FARO. La sezione aperta non e' segnata da un puntino ma da un alone del
 * SUO colore — blu per Home, verde per Allenamenti, viola per Squadra, ambra
 * per Partite, indaco per Societa' — che scivola da una casella all'altra e
 * cambia tinta strada facendo. Il colore lo si impara senza accorgersene, ed e'
 * l'unico segnale che funziona anche con la coda dell'occhio.
 *
 * Nessuna misura presa in JavaScript: le caselle sono larghe uguali, quindi
 * l'alone si sposta di «una casella per indice» e lo puo' dire il CSS da solo.
 */
function BarraMobile({ sezione, onSezione }) {
  const gruppi = gruppiVisibili(state.currentUser);

  // Home al centro. Con cinque voci finisce terza; con tre, seconda. Si toglie
  // dalla fila e si rimette in mezzo, cosi' la regola vale a qualunque numero.
  const voci = (() => {
    const altre = gruppi.filter(g => g.id !== 'apertura');
    const casa = gruppi.find(g => g.id === 'apertura');
    if (!casa) return gruppi;
    const fuori = altre.slice();
    fuori.splice(Math.floor(gruppi.length / 2), 0, casa);
    return fuori;
  })();

  const attiva = macroDiSezione(sezione);
  const indice = voci.findIndex(v => v.id === attiva);
  const acceso = indice >= 0 ? voci[indice] : null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 vetro-alto border-t border-bordo/12 md:hidden"
      aria-label="Sezioni"
      style={{
        '--n': voci.length,
        '--i': indice < 0 ? 0 : indice,
        '--faro': acceso ? tintaSezione(acceso.icona) : '0 0 0'
      }}
    >
      <div className="relative flex pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2.5">
        {/* L'alone sta prima delle caselle nel DOM, quindi resta dietro. */}
        {acceso && (
          <span className="barra-faro" aria-hidden="true"><i /></span>
        )}

        {voci.map(v => {
          const aperta = v.id === attiva;
          const g = gruppi.find(x => x.id === v.id);
          return (
            <button
              key={v.id}
              onClick={() => { if (!aperta && g) onSezione(primaDi(g)); }}
              aria-current={aperta ? 'page' : undefined}
              className="barra-voce relative flex flex-1 flex-col items-center gap-1.5 px-1 pb-0.5"
            >
              <IconaSezione id={v.icona} dim={40} className="barra-figura" />
              <span className="barra-etichetta w-full truncate text-center text-[10.5px] font-bold uppercase tracking-[0.03em]">
                {v.label}
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

  // Si segna dove si e' arrivati dentro la macro, per tornarci la volta dopo.
  useEffect(() => {
    const m = macroDiSezione(sezione);
    if (m) ultimaDi[m] = sezione;
  }, [sezione]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {nastro}
      <Testata onSezione={onSezione} sectorId={sectorId} onSettore={onSettore} strumenti={strumenti} />
      <div className="flex min-h-0 flex-1">
        <Colonna sezione={sezione} onSezione={onSezione} />
        <main id="contenuto" className="min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-7 md:pb-10 md:pr-6 lg:pb-12 lg:pr-8">
          <div className="mx-auto w-full max-w-[1120px]">
            <SottoBarra sezione={sezione} onSezione={onSezione} />
            <div className="animate-salita">{children}</div>
          </div>
        </main>
      </div>
      <BarraMobile sezione={sezione} onSezione={onSezione} />
    </div>
  );
}
