import React, { useState } from 'react';
import { state } from '../state.js';
import { updateCalendarMatch, removeCalendarMatch } from '../api/calendar.js';
import { canEditHome } from '../utils/permissions.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Scelta, Interruttore, useAvviso } from './moduli.jsx';

/* Il calendario.
 *
 * Come per gli allenamenti ci sono due viste, ma il criterio NON è la data.
 * Una partita giocata due settimane fa di cui nessuno ha inserito il punteggio
 * non è archiviata: è da fare. Dividendo per data sparirebbe fra le giocate
 * insieme al suo pulsante, che è l'unica ragione per cui la si cerca.
 *
 * Quindi una partita passa fra le Giocate quando ha un risultato. Restando fra
 * le Prossime, che sono ordinate per data, finisce in cima da sola — dove
 * serve — e porta scritto che il risultato manca.
 */

const oggiISO = () => new Date().toISOString().slice(0, 10);

function fmtData(iso) {
  if (!iso) return 'Data da definire';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function Calendario() {
  const [vista, setVista] = useState('prossime');
  const [modulo, setModulo] = useState(null);
  const [risultato, setRisultato] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditHome(state.currentUser);
  const oggi = oggiISO();

  const prossime = state.calendar.filter(m => !m.played)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const giocate = state.calendar.filter(m => m.played)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const elenco = vista === 'giocate' ? giocate : prossime;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={puoiModificare
          ? <Pulsante variante="primario" onClick={() => setModulo({})}>+ Partita</Pulsante>
          : null}
      >
        Calendario
      </Titolo>

      {state.calendar.length > 0 && (
        <Interruttore
          valore={vista}
          onCambia={setVista}
          voci={[
            { id: 'prossime', testo: 'Prossime', conteggio: prossime.length },
            { id: 'giocate', testo: 'Giocate', conteggio: giocate.length }
          ]}
        />
      )}

      {elenco.length === 0 ? (
        <Vuoto>
          {vista === 'giocate'
            ? 'Nessuna partita ancora giocata.'
            : 'Nessuna partita in calendario. Puoi caricare il PDF del calendario federale dall’app attuale.'}
        </Vuoto>
      ) : (
        <div className="space-y-2.5">
          {elenco.map(m => {
            const daSegnare = !m.played && m.date && m.date < oggi;
            return (
              <Pannello key={m.id} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg vetro orlo">
                  {m.giornata ? (
                    <div className="text-center leading-none">
                      <div className="text-[9px] font-bold uppercase tracking-etichetta text-tenue">gg</div>
                      <div className="mt-1 text-[16px] font-bold">{m.giornata}</div>
                    </div>
                  ) : (
                    <span className="text-[15px] text-tenue">·</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cx(
                      'shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-etichetta',
                      m.home === false ? 'bg-pannello/12 text-tenue' : 'bg-blu/16 text-blu'
                    )}>
                      {m.home === false ? 'fuori' : 'casa'}
                    </span>
                    <span className="truncate text-[14.5px] font-semibold leading-tight">{m.opponent}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] text-tenue">
                    <span>{fmtData(m.date)}</span>
                    {m.time && <span>{m.time}</span>}
                    {m.location && <span className="truncate">{m.location}</span>}
                  </div>
                  {daSegnare && (
                    <div className="mt-1.5">
                      <Stato tono="fermo">Risultato da inserire</Stato>
                    </div>
                  )}
                </div>

                {m.played ? (
                  <div className="shrink-0 text-[16px] font-bold">
                    {m.team_score ?? '?'}<span className="mx-1 text-tenue">–</span>{m.opp_score ?? '?'}
                  </div>
                ) : puoiModificare ? (
                  <Pulsante onClick={() => setRisultato(m)} className="shrink-0 py-1.5 text-[11.5px]">
                    Segna
                  </Pulsante>
                ) : null}

                {puoiModificare && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setModulo(m)}
                      title="Modifica"
                      className="rounded-lg px-2.5 py-2 text-tenue transition-colors hover:bg-pannello/12 hover:text-testo"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setDaRimuovere(m)}
                      title="Rimuovi"
                      className="rounded-lg px-2.5 py-2 text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </Pannello>
            );
          })}
        </div>
      )}

      {modulo && (
        <ModuloPartita
          esistente={modulo.id ? modulo : null}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { ridisegna(n => n + 1); avvisa(msg); }}
        />
      )}

      {risultato && (
        <ModuloRisultato
          partita={risultato}
          onChiudi={() => setRisultato(null)}
          onFatto={() => { ridisegna(n => n + 1); avvisa('Risultato salvato'); }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Rimuovere la partita?"
          testo={`${daRimuovere.opponent} · ${fmtData(daRimuovere.date)}. Viene tolta dal calendario.`}
          etichetta="Rimuovi"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removeCalendarMatch(daRimuovere.id);
            state.calendar = state.calendar.filter(x => x.id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Partita rimossa');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modulo */
function ModuloPartita({ esistente, onChiudi, onFatto }) {
  const [avversario, setAvversario] = useState(esistente ? esistente.opponent : '');
  const [data, setData] = useState(esistente ? (esistente.date || '') : '');
  const [ora, setOra] = useState(esistente ? (esistente.time || '') : '');
  const [luogo, setLuogo] = useState(esistente ? (esistente.location || '') : '');
  const [casa, setCasa] = useState(esistente ? (esistente.home !== false) : true);
  const [giornata, setGiornata] = useState(esistente && esistente.giornata != null ? String(esistente.giornata) : '');

  return (
    <Modulo
      titolo={esistente ? 'Modifica partita' : 'Nuova partita'}
      onChiudi={onChiudi}
      etichettaInvia={esistente ? 'Salva' : 'Aggiungi'}
      onInvia={async () => {
        const opp = avversario.trim();
        if (!opp) return 'Scrivi il nome dell’avversario.';
        const campi = {
          opponent: opp,
          date: data || null,
          time: ora.trim() || null,
          location: luogo.trim() || null,
          home: casa,
          giornata: giornata.trim() ? parseInt(giornata, 10) : null
        };
        if (esistente) {
          const agg = await updateCalendarMatch(esistente.id, campi);
          Object.assign(esistente, agg);
          onFatto('Partita salvata');
        } else {
          const { bulkInsertMatches } = await import('../api/calendar.js');
          const creati = await bulkInsertMatches(state.teamProfile.id, state.activeSectorId, [campi]);
          (creati || []).forEach(c => state.calendar.push(c));
          onFatto('Partita aggiunta');
        }
      }}
    >
      <Campo etichetta="Avversario">
        <Testo value={avversario} onChange={e => setAvversario(e.target.value)} placeholder="Virtus Forlimpopoli" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Dove">
          <Scelta value={casa ? 'casa' : 'fuori'} onChange={e => setCasa(e.target.value === 'casa')}>
            <option value="casa">In casa</option>
            <option value="fuori">In trasferta</option>
          </Scelta>
        </Campo>
        <Campo etichetta="Giornata" aiuto="Facoltativa">
          <Testo value={giornata} onChange={e => setGiornata(e.target.value.replace(/\D/g, ''))} placeholder="9" />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Data">
          <Data value={data} onChange={e => setData(e.target.value)} />
        </Campo>
        <Campo etichetta="Ora">
          <Testo value={ora} onChange={e => setOra(e.target.value)} placeholder="18:30" />
        </Campo>
      </div>
      <Campo etichetta="Luogo">
        <Testo value={luogo} onChange={e => setLuogo(e.target.value)} placeholder="Palestra Comunale" />
      </Campo>
    </Modulo>
  );
}

/* ---------------------------------------------------------------- risultato */
function ModuloRisultato({ partita, onChiudi, onFatto }) {
  const [nostri, setNostri] = useState(partita.team_score != null ? String(partita.team_score) : '');
  const [loro, setLoro] = useState(partita.opp_score != null ? String(partita.opp_score) : '');
  const noi = (state.teamProfile || {}).name || 'Noi';

  return (
    <Modulo
      titolo="Segna il risultato"
      sotto={`${partita.opponent} · ${fmtData(partita.date)}`}
      onChiudi={onChiudi}
      onInvia={async () => {
        if (nostri === '' || loro === '') return 'Inserisci tutti e due i punteggi.';
        const agg = await updateCalendarMatch(partita.id, {
          team_score: parseInt(nostri, 10),
          opp_score: parseInt(loro, 10),
          played: true
        });
        Object.assign(partita, agg);
        onFatto();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta={partita.home === false ? noi + ' (fuori)' : noi}>
          <Testo
            inputMode="numeric"
            value={nostri}
            onChange={e => setNostri(e.target.value.replace(/\D/g, ''))}
            className="text-center text-[22px] font-bold"
            autoFocus
          />
        </Campo>
        <Campo etichetta={partita.opponent}>
          <Testo
            inputMode="numeric"
            value={loro}
            onChange={e => setLoro(e.target.value.replace(/\D/g, ''))}
            className="text-center text-[22px] font-bold"
          />
        </Campo>
      </div>
    </Modulo>
  );
}
