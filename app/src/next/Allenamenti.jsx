import React, { useState } from 'react';
import { state } from '../state.js';
import { addTraining, updateTraining, removeTraining, fetchTrainingsForDate } from '../api/trainings.js';
import { findLocationConflicts } from '../utils/conflicts.js';
import { canEditHome } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Interruttore, useAvviso } from './moduli.jsx';
import { IconaSezione } from './icone.jsx';

/* Gli allenamenti.
 *
 * Due viste. Si apre sui futuri, ordinati dal più vicino: è quello che si
 * guarda per sapere cosa c'è domani. I passati si scelgono apposta e vanno dal
 * più recente, perché quando si torna indietro si torna indietro di poco.
 *
 * La soglia è la data di oggi INCLUSA: un allenamento delle 19 non deve sparire
 * dai futuri alle otto del mattino.
 */

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const oggiISO = () => new Date().toISOString().slice(0, 10);

function dataLunga(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('it-IT', { month: 'long' })}`;
}

function Riquadro({ iso }) {
  const d = new Date(iso + 'T00:00:00');
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg vetro orlo">
      <div className="text-center leading-none">
        <div className="text-[9px] font-bold uppercase tracking-etichetta text-tenue">
          {d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
        </div>
        <div className="mt-1 text-[16px] font-bold">{d.getDate()}</div>
      </div>
    </div>
  );
}

export function Allenamenti() {
  const [vista, setVista] = useState('futuri');
  const [modulo, setModulo] = useState(null);        // null | {} | allenamento
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditHome(state.currentUser);
  const oggi = oggiISO();

  const futuri = state.trainings.filter(t => t.date >= oggi)
    .sort((a, b) => a.date.localeCompare(b.date));
  const passati = state.trainings.filter(t => t.date < oggi)
    .sort((a, b) => b.date.localeCompare(a.date));

  const elenco = vista === 'passati' ? passati : futuri;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={puoiModificare
          ? <Pulsante variante="primario" onClick={() => setModulo({})}>+ Allenamento</Pulsante>
          : null}
      >
        Allenamenti
      </Titolo>

      {(futuri.length > 0 || passati.length > 0) && (
        <Interruttore
          valore={vista}
          onCambia={setVista}
          voci={[
            { id: 'futuri', testo: 'Futuri', conteggio: futuri.length },
            { id: 'passati', testo: 'Passati', conteggio: passati.length }
          ]}
        />
      )}

      {elenco.length === 0 ? (
        <Vuoto>
          {vista === 'passati'
            ? 'Nessun allenamento già svolto.'
            : 'Nessun allenamento in programma.'}
        </Vuoto>
      ) : (
        <div className="space-y-2.5">
          {elenco.map(t => (
            <Pannello key={t.id} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
              <Riquadro iso={t.date} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold leading-tight">{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-tenue">
                  <span>{dataLunga(t.date)}</span>
                  {t.start_time && <span>{t.start_time}{t.end_time ? `–${t.end_time}` : ''}</span>}
                  {t.recurrence_id && (
                    <span className="rounded-full bg-pannello/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-etichetta">
                      fisso
                    </span>
                  )}
                </div>
                {t.location && (
                  <div className="mt-1 truncate text-[12.5px] font-semibold text-soffuso">{t.location}</div>
                )}
              </div>
              {puoiModificare && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setModulo(t)}
                    title="Modifica"
                    className="rounded-lg px-2.5 py-2 text-tenue transition-colors hover:bg-pannello/12 hover:text-testo"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => setDaRimuovere(t)}
                    title="Rimuovi"
                    className="rounded-lg px-2.5 py-2 text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
                  >
                    ✕
                  </button>
                </div>
              )}
            </Pannello>
          ))}
        </div>
      )}

      {modulo && (
        <ModuloAllenamento
          esistente={modulo.id ? modulo : null}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { ridisegna(n => n + 1); avvisa(msg); }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Rimuovere l’allenamento?"
          testo={`${daRimuovere.title} · ${dataLunga(daRimuovere.date)}. Le presenze già rilevate vengono rimosse insieme.`}
          etichetta="Rimuovi"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removeTraining(daRimuovere.id);
            state.trainings = state.trainings.filter(x => x.id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Allenamento rimosso');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modulo */
function ModuloAllenamento({ esistente, onChiudi, onFatto }) {
  const [titolo, setTitolo] = useState(esistente ? esistente.title : '');
  const [data, setData] = useState(esistente ? esistente.date : oggiISO());
  const [inizio, setInizio] = useState(esistente ? (esistente.start_time || '') : '');
  const [fine, setFine] = useState(esistente ? (esistente.end_time || '') : '');
  const [luogo, setLuogo] = useState(esistente ? (esistente.location || '') : '');
  // Il conflitto avvisa e non blocca: dividere una palestra in due metà è una
  // cosa che le società fanno. Salvando una seconda volta si conferma.
  const [giaAvvisato, setGiaAvvisato] = useState(false);

  return (
    <Modulo
      titolo={esistente ? 'Modifica allenamento' : 'Nuovo allenamento'}
      onChiudi={onChiudi}
      etichettaInvia={esistente ? 'Salva' : 'Aggiungi'}
      onInvia={async () => {
        const t = titolo.trim();
        if (!t) return 'Scrivi un titolo.';
        if (!data) return 'Scegli una data.';

        const campi = {
          title: t, date: data,
          start_time: inizio.trim() || null,
          end_time: fine.trim() || null,
          location: luogo.trim() || null
        };

        if (!giaAvvisato && campi.location && !inCampione()) {
          // Si confronta con TUTTA la società, non solo con questa categoria:
          // la palestra è una sola, e il problema nasce proprio fra categorie
          // diverse che non si vedono a vicenda.
          const altri = await fetchTrainingsForDate(state.teamProfile.id, data).catch(() => []);
          const scontri = findLocationConflicts(
            { ...campi, id: esistente ? esistente.id : null },
            altri
          );
          if (scontri.length > 0) {
            setGiaAvvisato(true);
            const s = scontri[0];
            return `${s.location} risulta già occupata ${s.start_time || ''}`
              + `${s.end_time ? '–' + s.end_time : ''} da «${s.title}». Salva di nuovo per confermare.`;
          }
        }

        if (esistente) {
          const agg = await updateTraining(esistente.id, campi);
          Object.assign(esistente, agg);
          onFatto('Allenamento salvato');
        } else {
          const creato = await addTraining(state.teamProfile.id, state.activeSectorId, campi);
          state.trainings.push(creato);
          onFatto('Allenamento aggiunto');
        }
      }}
    >
      <Campo etichetta="Titolo">
        <Testo value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="Tecnica individuale" autoFocus />
      </Campo>
      <Campo etichetta="Data">
        <Data value={data} onChange={e => setData(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Inizio">
          <Testo value={inizio} onChange={e => setInizio(e.target.value)} placeholder="19:00" />
        </Campo>
        <Campo etichetta="Fine">
          <Testo value={fine} onChange={e => setFine(e.target.value)} placeholder="20:30" />
        </Campo>
      </div>
      <Campo
        etichetta="Luogo"
        aiuto="Scrivilo sempre allo stesso modo: è così che ci si accorge se due categorie prenotano la stessa palestra."
      >
        <Testo value={luogo} onChange={e => { setLuogo(e.target.value); setGiaAvvisato(false); }} placeholder="Palestra Comunale" />
      </Campo>
    </Modulo>
  );
}
