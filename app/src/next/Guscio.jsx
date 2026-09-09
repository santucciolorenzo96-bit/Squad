import React, { useState, useEffect } from 'react';
import { state } from '../state.js';
import { TABS, canSeeTab, isAdmin, isLinkedUser } from '../utils/permissions.js';
import { orderedSectors, sectorFullName } from '../utils/sectors.js';
import { cx, Avatar, Pulsante } from './ui.jsx';

/* Il guscio.
 *
 * Struttura a tre zone che non scorrono l'una nell'altra: testata, colonna
 * delle sezioni, contenuto. Scorre solo il contenuto — la colonna resta ferma
 * perché è l'unico modo di cambiare sezione, e sparire quando serve non è un
 * comportamento, è un difetto.
 *
 * Sotto i 900px la colonna non c'è: c'è una barra in basso con le voci
 * principali e un foglio "Altro" per il resto. Non è la stessa navigazione
 * rimpicciolita, è una navigazione diversa, perché il pollice arriva in basso
 * e non in alto a sinistra.
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
// Le sottocategorie rientrano. Un elenco piatto in cui "Blu" e "Under 15"
// pesano uguale non dice che una sta dentro l'altra.
function Categorie({ attiva, onCambia }) {
  const settori = settoriAccessibili();
  if (settori.length <= 1) {
    return settori.length === 1
      ? <div className="etichetta">{sectorFullName(settori[0], state.sectors)}</div>
      : null;
  }
  return (
    <div className="flex items-stretch overflow-x-auto -mx-1 px-1">
      {settori.map(s => {
        const on = s.id === attiva;
        return (
          <button
            key={s.id}
            onClick={() => onCambia(s.id)}
            title={sectorFullName(s, state.sectors)}
            className={cx(
              'whitespace-nowrap border-b-2 px-3 py-1.5 text-[12.5px] transition-colors',
              s.parent_id && 'pl-5',
              on
                ? 'border-timbro font-bold text-inchiostro'
                : 'border-transparent font-medium text-grafite hover:text-inchiostro'
            )}
          >
            {s.parent_id && <span className="mr-1 text-grafite">└</span>}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ testata */
function Testata({ sezione, onSezione, sectorId, onSettore }) {
  const squadra = state.teamProfile || {};
  return (
    <header className="shrink-0 border-b-2 riga bg-carta">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        {/* Il marchio è tipografico: nome della società in serif, SQUAD come
            piccola sigla incisa sopra. Un logo non serve a dire dove sei. */}
        <button onClick={() => onSezione('home')} className="min-w-0 text-left">
          <div className="etichetta leading-none">Squad</div>
          <div className="truncate font-serif text-[19px] leading-tight">{squadra.name || 'Società'}</div>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onSezione('profilo')}
            className="flex items-center gap-2 border riga px-2 py-1 hover:shadow-sm"
          >
            <Avatar nome={state.currentUser && state.currentUser.display_name} url={state.myAvatarUrl} dim={26} />
            <span className="hidden sm:block max-w-[150px] truncate text-[12.5px] font-semibold">
              {state.currentUser && state.currentUser.display_name}
            </span>
          </button>
        </div>
      </div>

      <div className="border-t riga px-2 sm:px-5">
        <Categorie attiva={sectorId} onCambia={onSettore} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------- colonna a sinistra */
const NOMI_GRUPPO = { settore: 'Categoria', societa: 'Società' };

function Colonna({ sezione, onSezione }) {
  const voci = sezioniVisibili(state.currentUser);
  const gruppi = ['settore', 'societa'];
  return (
    <nav className="hidden lg:flex w-[210px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r-2 riga bg-carta2/60 px-2 py-4">
      {gruppi.map(g => {
        const dentro = voci.filter(v => v.group === g);
        if (dentro.length === 0) return null;
        return (
          <div key={g} className="mb-3">
            <div className="etichetta px-2 pb-1.5">{NOMI_GRUPPO[g]}</div>
            {dentro.map(v => {
              const on = v.id === sezione;
              return (
                <button
                  key={v.id}
                  onClick={() => onSezione(v.id)}
                  className={cx(
                    'flex w-full items-center gap-2 px-2 py-[7px] text-left text-[13px] transition-colors',
                    on
                      ? 'bg-inchiostro font-bold text-carta'
                      : 'font-medium text-grafite hover:bg-carta2 hover:text-inchiostro'
                  )}
                >
                  {/* Il trattino a sinistra della voce attiva: è come si segna
                      una riga su un elenco stampato. */}
                  <span className={cx('w-3 shrink-0 font-mono', on ? 'opacity-100' : 'opacity-0')}>—</span>
                  {v.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------- barra mobile */
function BarraMobile({ sezione, onSezione }) {
  const [altroAperto, setAltro] = useState(false);
  const voci = sezioniVisibili(state.currentUser);
  const principali = voci.filter(v => v.primary).slice(0, 4);
  const resto = voci.filter(v => !principali.includes(v));

  return (
    <>
      {altroAperto && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setAltro(false)}>
          <div className="absolute inset-0 bg-inchiostro/35" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto border-t-2 riga bg-carta px-3 pb-24 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="etichetta px-1 pb-2">Tutte le sezioni</div>
            <div className="grid grid-cols-2 gap-2">
              {resto.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setAltro(false); onSezione(v.id); }}
                  className={cx(
                    'border riga px-3 py-3 text-left text-[13px] font-semibold',
                    v.id === sezione ? 'bg-inchiostro text-carta' : 'bg-carta hover:shadow-sm'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t-2 riga bg-carta lg:hidden">
        {principali.map(v => (
          <button
            key={v.id}
            onClick={() => onSezione(v.id)}
            className={cx(
              'flex-1 border-r riga py-2.5 text-[11px] font-bold uppercase tracking-etichetta',
              v.id === sezione ? 'bg-inchiostro text-carta' : 'text-grafite'
            )}
          >
            {v.label}
          </button>
        ))}
        {resto.length > 0 && (
          <button
            onClick={() => setAltro(a => !a)}
            className={cx(
              'flex-1 py-2.5 text-[11px] font-bold uppercase tracking-etichetta',
              altroAperto ? 'bg-inchiostro text-carta' : 'text-grafite'
            )}
          >
            Altro
          </button>
        )}
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ guscio */
export function Guscio({ sezione, onSezione, sectorId, onSettore, nastro, children }) {
  // La sezione aperta torna in cima: senza, cambiando sezione ci si ritrova a
  // metà pagina di una schermata mai vista.
  useEffect(() => {
    const el = document.getElementById('contenuto');
    if (el) el.scrollTop = 0;
  }, [sezione, sectorId]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {nastro}
      <Testata sezione={sezione} onSezione={onSezione} sectorId={sectorId} onSettore={onSettore} />
      <div className="flex min-h-0 flex-1">
        <Colonna sezione={sezione} onSezione={onSezione} />
        <main id="contenuto" className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full max-w-[1080px]">{children}</div>
        </main>
      </div>
      <BarraMobile sezione={sezione} onSezione={onSezione} />
    </div>
  );
}
