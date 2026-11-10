import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { state } from '../state.js';
import { fetchPlays } from '../api/plays.js';
import { canEditRoster, managesSector } from '../utils/permissions.js';
import {
  normalizzaSchema, tutteLeEtichette, filtraSchemi, ordinaSchemi, etichetteUniche, riepilogo
} from '../utils/schemi.js';
import { inCampione } from './campione.js';
import { SchemiCampo } from './SchemiCampo.jsx';
import { SchemaLettore } from './SchemiLettore.jsx';
import { SchemaEditor } from './SchemiEditor.jsx';
import { Pannello, Titolo, Pulsante, Vuoto, Scheletro, Stato, Cerca, NessunRisultato, cx } from './ui.jsx';
import { ErroreCaricamento } from './moduli.jsx';

/* SCHEMI.
 *
 * L'allenatore disegna gli schemi, gli atleti li rivedono. Questa e` la lista:
 * un'anteprima per ogni schema, le etichette per ritrovarli, e un tocco per
 * vederlo muoversi.
 *
 * Gli atleti vedono solo quello che e` pubblicato — lo garantisce il database,
 * non questa schermata — e l'allenatore vede anche le bozze, segnate.
 */

function Scheda({ play, onApri }) {
  const schema = useMemo(() => normalizzaSchema(play.data), [play.data]);
  const r = riepilogo(schema);
  const etichette = etichetteUniche(play.labels);
  const bozza = play.status !== 'published';

  return (
    <button
      type="button"
      onClick={onApri}
      className="group block w-full text-left"
    >
      <Pannello className="overflow-hidden transition-colors group-hover:bg-pannello/8">
        <div className="relative">
          <SchemiCampo pos={schema.start.pos} palla={null} compatto />
          {bozza && (
            <div className="absolute left-2.5 top-2.5"><Stato tono="attesa">Bozza</Stato></div>
          )}
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="truncate text-[14.5px] font-bold leading-tight">{play.title}</div>
          <div className="mt-1 text-[12.5px] text-tenue">
            <span className="cifra">{r.passi}</span> {r.passi === 1 ? 'passo' : 'passi'}
            {r.varianti > 0 && (
              <> · <span className="cifra">{r.varianti}</span> {r.varianti === 1 ? 'variante' : 'varianti'}</>
            )}
          </div>
          {etichette.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {etichette.slice(0, 3).map(e => (
                <span key={e} className="rounded-full bg-pannello/12 px-2 py-0.5 text-[11.5px] font-semibold text-soffuso">{e}</span>
              ))}
              {etichette.length > 3 && (
                <span className="rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold text-tenue">+{etichette.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </Pannello>
    </button>
  );
}

export function Schemi() {
  const sectorId = state.activeSectorId;
  const puoiModificare = canEditRoster(state.currentUser)
    && managesSector(state.currentUser, sectorId, state.staffSectors);

  const [schemi, setSchemi] = useState(null);
  const [errore, setErrore] = useState(null);
  const [selezionate, setSelezionate] = useState([]);
  const [ricerca, setRicerca] = useState('');
  const [aperto, setAperto] = useState(null);       // { play, modifica }
  const [nuovo, setNuovo] = useState(false);

  const carica = useCallback(() => {
    setErrore(null);
    if (inCampione()) { setSchemi([]); return undefined; }
    let vivo = true;
    fetchPlays(sectorId)
      .then(r => { if (vivo) setSchemi(r); })
      .catch(e => { if (vivo) setErrore(e); });
    return () => { vivo = false; };
  }, [sectorId]);

  useEffect(() => {
    setSchemi(null);
    setSelezionate([]);
    setRicerca('');
    return carica();
  }, [carica]);

  const etichette = useMemo(() => tutteLeEtichette(schemi || []), [schemi]);
  const visibili = useMemo(
    () => ordinaSchemi(filtraSchemi(schemi || [], selezionate, ricerca)),
    [schemi, selezionate, ricerca]
  );

  function alterna(nome) {
    setSelezionate(s => (s.some(x => x.toLowerCase() === nome.toLowerCase())
      ? s.filter(x => x.toLowerCase() !== nome.toLowerCase())
      : [...s, nome]));
  }

  // Dopo un salvataggio la lista si rilegge: e` l'unico modo di avere anche i
  // campi che scrive il server (chi ha salvato, la data di pubblicazione).
  function salvato(riga) {
    carica();
    setAperto(a => (a ? { ...a, play: riga } : a));
  }

  return (
    <div className="sezioni">
      <Titolo
        sopra="Squadra"
        azione={puoiModificare && (
          <Pulsante variante="primario" className="shrink-0 py-2 text-[13px]" onClick={() => setNuovo(true)}>
            + Nuovo schema
          </Pulsante>
        )}
      >
        Schemi
      </Titolo>

      {errore ? (
        <ErroreCaricamento cosa="gli schemi" errore={errore} onRiprova={carica} />
      ) : schemi === null ? (
        <Scheletro righe={4} />
      ) : schemi.length === 0 ? (
        <Vuoto>
          {puoiModificare
            ? 'Non hai ancora disegnato nessuno schema. Con «+ Nuovo schema» scegli le posizioni di partenza, aggiungi i passi e pubblica: gli atleti lo rivedono come animazione.'
            : 'L’allenatore non ha ancora pubblicato nessuno schema per questa categoria.'}
        </Vuoto>
      ) : (
        <>
          {schemi.length > 6 && (
            <Cerca valore={ricerca} onCambia={setRicerca} segnaposto="Cerca uno schema…" />
          )}

          {etichette.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-1.5 sm:w-auto sm:flex-wrap">
                {etichette.map(e => {
                  const on = selezionate.some(x => x.toLowerCase() === e.nome.toLowerCase());
                  return (
                    <button
                      key={e.nome}
                      onClick={() => alterna(e.nome)}
                      aria-pressed={on}
                      className={cx(
                        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-150',
                        on ? 'vivo font-bold text-white' : 'vetro orlo font-semibold text-soffuso hover:text-testo'
                      )}
                    >
                      {e.nome} <span className={cx('cifra ml-0.5', on ? 'opacity-75' : 'opacity-60')}>{e.n}</span>
                    </button>
                  );
                })}
                {selezionate.length > 0 && (
                  <button
                    onClick={() => setSelezionate([])}
                    className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
                  >
                    Azzera
                  </button>
                )}
              </div>
            </div>
          )}

          {visibili.length === 0 ? (
            ricerca
              ? <NessunRisultato cosa="Nessuno schema" ago={ricerca} />
              : <Vuoto>Nessuno schema ha tutte le etichette scelte. Togline una per allargare la ricerca.</Vuoto>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 lg:grid-cols-3">
              {visibili.map(p => (
                <Scheda key={p.id} play={p} onApri={() => setAperto({ play: p, modifica: false })} />
              ))}
            </div>
          )}
        </>
      )}

      {aperto && !aperto.modifica && (
        <SchemaLettore
          play={aperto.play}
          onChiudi={() => setAperto(null)}
          onModifica={puoiModificare ? () => setAperto({ play: aperto.play, modifica: true }) : undefined}
        />
      )}

      {aperto && aperto.modifica && (
        <SchemaEditor
          play={aperto.play}
          sectorId={sectorId}
          etichetteInUso={etichette.map(e => e.nome)}
          onChiudi={() => setAperto(null)}
          onSalvato={salvato}
          onEliminato={() => { setAperto(null); carica(); }}
        />
      )}

      {nuovo && (
        <SchemaEditor
          play={null}
          sectorId={sectorId}
          etichetteInUso={etichette.map(e => e.nome)}
          onChiudi={() => setNuovo(false)}
          onSalvato={() => carica()}
          onEliminato={() => { setNuovo(false); carica(); }}
        />
      )}
    </div>
  );
}
