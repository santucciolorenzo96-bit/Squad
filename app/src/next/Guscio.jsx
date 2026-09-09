import React, { useState, useEffect } from 'react';
import { state } from '../state.js';
import { TABS, canSeeTab, isAdmin, isLinkedUser } from '../utils/permissions.js';
import { orderedSectors, sectorFullName } from '../utils/sectors.js';
import { cx, Avatar, Pannello } from './ui.jsx';
import { IconaSezione, Chevron } from './icone.jsx';

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
// Pastiglie. La sottocategoria è più piccola e rientra: un elenco piatto in cui
// "Blu" e "Under 15" pesano uguale non dice che una sta dentro l'altra.
function Categorie({ attiva, onCambia }) {
  const settori = settoriAccessibili();
  if (settori.length === 0) return null;
  if (settori.length === 1) {
    return <div className="etichetta">{sectorFullName(settori[0], state.sectors)}</div>;
  }
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      {settori.map(s => {
        const on = s.id === attiva;
        return (
          <button
            key={s.id}
            onClick={() => onCambia(s.id)}
            title={sectorFullName(s, state.sectors)}
            className={cx(
              'shrink-0 whitespace-nowrap rounded-full transition-all duration-150',
              s.parent_id ? 'px-3 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[12.5px]',
              on
                ? 'bg-gradient-to-br from-blu to-blu2 font-bold text-white shadow-blu'
                : 'vetro orlo font-semibold text-soffuso hover:text-testo'
            )}
          >
            {s.parent_id && <span className="mr-1 opacity-50">·</span>}
            {s.name}
          </button>
        );
      })}
    </div>
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
          {/* Il marchio: monogramma in vetro, poi il nome della società. SQUAD
              sta sopra piccolo perché il prodotto non è la notizia — la società
              lo è. */}
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blu to-blu2 text-[15px] font-bold text-white shadow-blu lg:h-11 lg:w-11">
            S
          </span>
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
function BarraMobile({ sezione, onSezione }) {
  const [altro, setAltro] = useState(false);
  const voci = sezioniVisibili(state.currentUser);
  const principali = voci.filter(v => v.primary).slice(0, 4);
  const resto = voci.filter(v => !principali.includes(v));

  return (
    <>
      {altro && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setAltro(false)}>
          <div className="absolute inset-0 bg-fondo/70 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[74vh] overflow-y-auto rounded-t-2xl vetro-alto border-t border-bordo/12 px-3 pb-28 pt-4 animate-salita"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pannello/25" />
            <div className="etichetta px-1 pb-2.5">Tutte le sezioni</div>
            <div className="grid grid-cols-2 gap-2">
              {resto.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setAltro(false); onSezione(v.id); }}
                  className={cx(
                    'flex items-center gap-2.5 rounded px-3 py-3 text-left text-[13px] font-semibold orlo',
                    v.id === sezione ? 'vetro-alto text-testo' : 'vetro text-soffuso'
                  )}
                >
                  <IconaSezione id={v.id} dim={30} />
                  <span className="min-w-0 truncate">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 flex vetro-alto border-t border-bordo/12 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {principali.map(v => {
          const on = v.id === sezione;
          return (
            <button
              key={v.id}
              onClick={() => onSezione(v.id)}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2"
            >
              <IconaSezione id={v.id} dim={30} className={on ? '' : 'opacity-55'} />
              <span className={cx('w-full truncate text-center text-[9px] font-bold uppercase tracking-[0.06em]',
                on ? 'text-testo' : 'text-tenue')}>
                {v.label}
              </span>
              {on && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-blu" />}
            </button>
          );
        })}
        {resto.length > 0 && (
          <button
            onClick={() => setAltro(a => !a)}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2"
          >
            <span className={cx('grid h-[30px] w-[30px] place-items-center rounded-sm orlo',
              altro ? 'vetro-alto' : 'vetro')}>
              <Chevron dim={14} className={cx('transition-transform', altro ? '-rotate-90' : 'rotate-90')} />
            </span>
            <span className={cx('text-[9px] font-bold uppercase tracking-[0.06em]',
              altro ? 'text-testo' : 'text-tenue')}>
              Altro
            </span>
          </button>
        )}
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ guscio */
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
        <main id="contenuto" className="min-w-0 flex-1 overflow-y-auto px-4 pb-28 pt-6 sm:px-6 sm:pt-7 lg:pb-12 lg:pr-8">
          <div className="mx-auto w-full max-w-[1120px] animate-salita">{children}</div>
        </main>
      </div>
      <BarraMobile sezione={sezione} onSezione={onSezione} />
    </div>
  );
}
