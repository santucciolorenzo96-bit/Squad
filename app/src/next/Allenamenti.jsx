import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { addTraining, updateTraining, removeTraining, fetchTrainingsForDate } from '../api/trainings.js';
import {
  WEEKDAY_LABELS, createRecurrence, updateRecurrence, removeRecurrence,
  ensureOccurrencesGenerated, contaOccorrenzeFuture, rimuoviOccorrenzeFuture
} from '../api/trainingRecurrences.js';
import { findLocationConflicts } from '../utils/conflicts.js';
import { canEditHome, managesSector } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, cx, AzioneRiga } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Scelta, Spunta, Interruttore, Finestra, useAvviso } from './moduli.jsx';
import { IconaSezione, Chevron, Matita, Croce } from './icone.jsx';
import { FoglioPresenze } from './FoglioPresenze.jsx';
import { oggiISO } from '../utils/format.js';

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
// La settimana comincia di lunedì: è come si guarda un calendario in Italia, e
// il fine settimana finisce in fondo invece che spezzato fra le due estremità.
const INIZIALI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function meseDi(iso) { return (iso || '').slice(0, 7); }

function nomeMese(chiave) {
  const d = new Date(chiave + '-01T00:00:00');
  const m = d.toLocaleDateString('it-IT', { month: 'long' });
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
}

function isoDi(anno, mese, giorno) {
  return anno + '-' + String(mese + 1).padStart(2, '0') + '-' + String(giorno).padStart(2, '0');
}

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
        <div className="text-[10px] font-bold uppercase tracking-etichetta text-tenue">
          {d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
        </div>
        <div className="mt-1 text-[16px] font-bold">{d.getDate()}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- il calendario */
/* La stessa roba dell'elenco, disposta come la si ha in testa.
 *
 * L'elenco risponde a "cosa c'è dopo", il calendario a "quante volte ci
 * alleniamo questa settimana" e "che buco c'è a fine mese": sono due domande
 * diverse, e una sola disposizione non le serve tutte e due.
 *
 * Il mese si sceglie qui e non segue futuri/passati: in un calendario si passa
 * da un mese all'altro avanti e indietro, e una vista che si rifiuta di
 * mostrare il mese scorso non è un calendario.
 */
function Calendario({ allenamenti, puoiModificare, onApri, onPresenze }) {
  const oggi = oggiISO();
  const [mese, setMese] = useState(meseDi(oggi));
  const [giorno, setGiorno] = useState(null);

  const perGiorno = {};
  allenamenti.forEach(t => {
    if (!perGiorno[t.date]) perGiorno[t.date] = [];
    perGiorno[t.date].push(t);
  });
  Object.keys(perGiorno).forEach(k => {
    perGiorno[k].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  });

  const anno = parseInt(mese.slice(0, 4), 10);
  const m = parseInt(mese.slice(5, 7), 10) - 1;
  const primo = new Date(anno, m, 1);
  const giorniNelMese = new Date(anno, m + 1, 0).getDate();
  // getDay() dà 0 per domenica: con la settimana che parte di lunedì la
  // domenica va in fondo, non in testa.
  const vuoteDavanti = (primo.getDay() + 6) % 7;

  function spostaMese(passo) {
    const d = new Date(anno, m + passo, 1);
    setMese(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    setGiorno(null);
  }

  const celle = [];
  for (let i = 0; i < vuoteDavanti; i++) celle.push(null);
  for (let g = 1; g <= giorniNelMese; g++) celle.push(isoDi(anno, m, g));

  const nelMese = allenamenti.filter(t => meseDi(t.date) === mese).length;
  const scelti = giorno ? (perGiorno[giorno] || []) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => spostaMese(-1)}
          className="grid h-8 w-8 place-items-center rounded-lg vetro orlo text-tenue transition-colors hover:text-testo"
          title="Mese precedente"
        >
          <span className="rotate-180"><Chevron dim={14} /></span>
        </button>
        <div className="text-center">
          <div className="text-[14.5px] font-semibold leading-tight">{nomeMese(mese)}</div>
          <div className="text-[12.5px] text-tenue">
            {nelMese === 0 ? 'nessun allenamento' : nelMese === 1 ? '1 allenamento' : nelMese + ' allenamenti'}
          </div>
        </div>
        <button
          onClick={() => spostaMese(1)}
          className="grid h-8 w-8 place-items-center rounded-lg vetro orlo text-tenue transition-colors hover:text-testo"
          title="Mese successivo"
        >
          <Chevron dim={14} />
        </button>
      </div>

      <Pannello className="overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1">
          {INIZIALI.map((g, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-bold uppercase tracking-etichetta text-tenue">
              {g}
            </div>
          ))}
          {celle.map((iso, i) => {
            if (!iso) return <div key={'v' + i} />;
            const voci = perGiorno[iso] || [];
            const oggiQui = iso === oggi;
            const scelto = iso === giorno;
            return (
              <button
                key={iso}
                onClick={() => setGiorno(scelto ? null : iso)}
                className={cx(
                  'min-h-[3.1rem] rounded-lg p-1 text-left align-top transition-colors sm:min-h-[4.6rem]',
                  scelto ? 'bg-blu/16 ring-1 ring-blu' : voci.length ? 'bg-pannello/10 hover:bg-pannello/16' : 'hover:bg-pannello/8'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cx(
                      'cifra text-[12.5px] font-semibold',
                      oggiQui ? 'grid h-5 w-5 place-items-center rounded-full vivo text-white' : 'text-soffuso'
                    )}
                  >
                    {parseInt(iso.slice(8, 10), 10)}
                  </span>
                  {voci.length > 0 && (
                    <span className="cifra text-[11px] font-bold text-blu sm:hidden">{voci.length}</span>
                  )}
                </div>

                {/* Su telefono la cella è troppo stretta per un titolo: resta
                    un pallino per allenamento, che dice quanti sono senza
                    mentire su cosa siano. */}
                <div className="mt-1 flex gap-0.5 sm:hidden">
                  {voci.slice(0, 3).map((t, k) => (
                    <span key={k} className="h-1 w-1 rounded-full bg-blu" />
                  ))}
                </div>

                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {voci.slice(0, 2).map(t => (
                    <div
                      key={t.id}
                      className="truncate rounded bg-gradient-to-r from-blu/25 to-blu2/25 px-1 py-0.5 text-[11px] font-semibold leading-tight"
                    >
                      {t.start_time ? t.start_time.slice(0, 5) + ' ' : ''}{t.title}
                    </div>
                  ))}
                  {voci.length > 2 && (
                    <div className="px-1 text-[11px] text-tenue">+{voci.length - 2}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Pannello>

      {giorno && (
        <div className="space-y-2.5">
          <Etichetta>{dataLunga(giorno)}</Etichetta>
          {scelti.length === 0 ? (
            <Vuoto>Nessun allenamento in questo giorno.</Vuoto>
          ) : (
            scelti.map(t => (
              <Riga key={t.id} t={t} puoiModificare={puoiModificare} onApri={onApri} onPresenze={onPresenze} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// La spunta su un elenco: monocromatica come la matita e la croce accanto,
// perche' sono tre gesti della stessa famiglia. L'icona a colori delle sezioni
// qui peserebbe come un titolo.
function IconaPresenze({ dim = 17 }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5h6M3 10h6M3 14.5h6" />
      <path d="m12.2 5.6 1.9 1.9 3.4-3.6" />
      <path d="m12.2 14.1 1.9 1.9 3.4-3.6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ la riga */
function Riga({ t, puoiModificare, onApri, onRimuovi, onPresenze }) {
  return (
    <Pannello className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
      <Riquadro iso={t.date} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold leading-tight">{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-tenue">
          <span>{dataLunga(t.date)}</span>
          {t.start_time && <span>{t.start_time}{t.end_time ? '–' + t.end_time : ''}</span>}
          {t.recurrence_id && (
            <span className="rounded-full bg-pannello/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-etichetta">
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
          {onPresenze && (
            <AzioneRiga etichetta="Presenze" onClick={() => onPresenze(t)}>
              <IconaPresenze />
            </AzioneRiga>
          )}
          <AzioneRiga etichetta="Modifica" onClick={() => onApri(t)}>
            <Matita />
          </AzioneRiga>
          {/* Quello che cancella sta staccato, dopo un filo: la distanza e'
              l'unica cosa che impedisce il tocco sbagliato a chi ha la mano
              meno ferma, e qui l'errore non si recupera. */}
          {onRimuovi && (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-bordo/12" aria-hidden="true" />
              <AzioneRiga etichetta="Elimina" pericolo onClick={() => onRimuovi(t)}>
                <Croce />
              </AzioneRiga>
            </>
          )}
        </div>
      )}
    </Pannello>
  );
}

export function Allenamenti() {
  const [vista, setVista] = useState('futuri');
  const [modo, setModo] = useState('elenco');        // elenco | calendario
  const [modulo, setModulo] = useState(null);        // null | {} | allenamento
  const [presenze, setPresenze] = useState(null);    // l'allenamento di cui si segnano le presenze
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [programmi, setProgrammi] = useState(false);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  // Il ruolo non basta: si modifica solo la categoria che ti e' stata
  // assegnata. Chi vede questa categoria perche' ci gioca la guarda e basta.
  const puoiModificare = canEditHome(state.currentUser) && managesSector(state.currentUser, state.activeSectorId, state.staffSectors);
  const oggi = oggiISO();

  /* LE OCCORRENZE DEI GIORNI FISSI NASCONO QUI.
   *
   * All'apertura della schermata, otto settimane avanti, e solo per chi può
   * scrivere in questa categoria: a un genitore il database rifiuterebbe la
   * scrittura, e provarci vorrebbe dire un errore per una cosa che non ha
   * chiesto di fare.
   *
   * È idempotente: salta le date che esistono già. Non lo era — le creava
   * senza stagione, e quindi non ritrovava mai le proprie: ogni apertura ne
   * faceva una copia nuova, ed è così che sono nati i doppioni di settembre.
   * Il difetto è chiuso in api/stagione.js, ma vale la pena ricordarlo qui,
   * perché questo è il punto in cui si vedeva.
   */
  useEffect(() => {
    if (!puoiModificare || inCampione()) return;
    if ((state.trainingRecurrences || []).length === 0) return;
    let vivo = true;
    (async () => {
      try {
        const creati = await ensureOccurrencesGenerated(
          state.teamProfile.id, state.activeSectorId,
          state.trainingRecurrences, state.trainings
        );
        if (!vivo || creati.length === 0) return;
        state.trainings = state.trainings.concat(creati);
        ridisegna(n => n + 1);
      } catch (e) {
        // Non blocca la schermata: gli allenamenti già in elenco si vedono lo
        // stesso. Ma non in silenzio — se i giorni fissi hanno smesso di
        // produrre, chi li ha impostati deve poterlo sapere.
        console.error(e);
        if (vivo) avvisa('I giorni fissi non hanno generato gli allenamenti: riprova più tardi.', 'errore');
      }
    })();
    return () => { vivo = false; };
    // Una volta per apertura e per categoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSectorId]);

  const futuri = state.trainings.filter(t => t.date >= oggi)
    .sort((a, b) => a.date.localeCompare(b.date));
  const passati = state.trainings.filter(t => t.date < oggi)
    .sort((a, b) => b.date.localeCompare(a.date));

  const elenco = vista === 'passati' ? passati : futuri;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={
          <div className="flex flex-wrap items-center gap-2">
            {/* Anche a chi non può modificare: sapere che il martedì e il
                giovedì sono fissi è un'informazione, non un comando. */}
            <Pulsante onClick={() => setProgrammi(true)}>Giorni fissi</Pulsante>
            {puoiModificare && (
              <Pulsante variante="primario" onClick={() => setModulo({})}>+ Allenamento</Pulsante>
            )}
          </div>
        }
      >
        Allenamenti
      </Titolo>

      {(futuri.length > 0 || passati.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Futuri/passati vale solo per l'elenco: il calendario mostra un
              mese intero, e dentro un mese ci sono per forza tutti e due. */}
          {modo === 'elenco' ? (
            <Interruttore
              valore={vista}
              onCambia={setVista}
              voci={[
                { id: 'futuri', testo: 'Futuri', conteggio: futuri.length },
                { id: 'passati', testo: 'Passati', conteggio: passati.length }
              ]}
            />
          ) : <span />}
          <Interruttore
            valore={modo}
            onCambia={setModo}
            voci={[
              { id: 'elenco', testo: 'Elenco' },
              { id: 'calendario', testo: 'Calendario' }
            ]}
          />
        </div>
      )}

      {modo === 'calendario' ? (
        <Calendario
          allenamenti={state.trainings}
          puoiModificare={puoiModificare}
          onApri={(t) => setModulo(t)}
          onPresenze={(t) => setPresenze(t)}
        />
      ) : elenco.length === 0 ? (
        <Vuoto>
          {vista === 'passati'
            ? 'Nessun allenamento già svolto.'
            : 'Nessun allenamento in programma.'}
        </Vuoto>
      ) : (
        <div className="space-y-2.5">
          {elenco.map((t, i) => {
            // Lo stacco fra un mese e l'altro: in un elenco lungo tutte le
            // righe si somigliano, e senza un respiro dichiarato «giovedì 30»
            // e «lunedì 3» sembrano la stessa settimana.
            const nuovoMese = i === 0 || meseDi(t.date) !== meseDi(elenco[i - 1].date);
            return (
              <React.Fragment key={t.id}>
                {nuovoMese && (
                  <div className={cx('flex items-center gap-3', i > 0 && 'pt-4')}>
                    <Etichetta>{nomeMese(meseDi(t.date))}</Etichetta>
                    <span className="h-px flex-1 bg-bordo/10" />
                    <span className="cifra text-[12.5px] text-tenue">
                      {elenco.filter(x => meseDi(x.date) === meseDi(t.date)).length}
                    </span>
                  </div>
                )}
                <Riga
                  t={t}
                  puoiModificare={puoiModificare}
                  onApri={(x) => setModulo(x)}
                  onPresenze={(x) => setPresenze(x)}
                  onRimuovi={(x) => setDaRimuovere(x)}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {presenze && (
        <FoglioPresenze allenamento={presenze} onChiudi={() => setPresenze(null)} />
      )}

      {modulo && (
        <ModuloAllenamento
          esistente={modulo.id ? modulo : null}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { ridisegna(n => n + 1); avvisa(msg); }}
        />
      )}

      {programmi && (
        <ProgrammiFissi
          puoiModificare={puoiModificare}
          onChiudi={() => setProgrammi(false)}
          onCambiato={(msg) => { ridisegna(n => n + 1); avvisa(msg); }}
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


/* ======================================================================== */
/* I PROGRAMMI FISSI                                                        */
/* ======================================================================== */
/*
 * «Il martedì e il giovedì alle 18:30, in palestra comunale.» È così che una
 * squadra si allena, e scriverlo trentadue volte a mano non è un lavoro: è un
 * modo di sbagliarne una.
 *
 * Esistevano già — tabella, regole di accesso, notifiche — ma solo
 * nell'interfaccia precedente: qui i programmi si vedevano soltanto come una
 * pastiglia sugli allenamenti che ne erano nati. Una funzione a metà, e del
 * tipo peggiore: quello che una società scopre a ottobre chiedendosi perché
 * gli allenamenti fissi hanno smesso di comparire.
 *
 * Le occorrenze si generano all'apertura della schermata, otto settimane
 * avanti. Non è un lavoro periodico da qualche parte: è qui, quando qualcuno
 * guarda, ed è l'unico momento in cui serve che ci siano.
 */

function ModuloRicorrenza({ esistente, onChiudi, onFatto }) {
  const [giorno, setGiorno] = useState(esistente ? String(esistente.weekday) : '2');
  const [inizio, setInizio] = useState(esistente ? (esistente.start_time || '') : '');
  const [fine, setFine] = useState(esistente ? (esistente.end_time || '') : '');
  const [luogo, setLuogo] = useState(esistente ? (esistente.location || '') : '');
  const [attivo, setAttivo] = useState(esistente ? esistente.active !== false : true);

  return (
    <Modulo
      titolo={esistente ? 'Modifica il giorno fisso' : 'Nuovo giorno fisso'}
      sotto="Da qui nascono da soli gli allenamenti delle prossime otto settimane."
      onChiudi={onChiudi}
      etichettaInvia={esistente ? 'Salva' : 'Aggiungi'}
      onInvia={async () => {
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';
        const campi = {
          weekday: parseInt(giorno, 10),
          start_time: inizio.trim() || null,
          end_time: fine.trim() || null,
          location: luogo.trim() || null,
          active: attivo
        };
        if (esistente) {
          const agg = await updateRecurrence(esistente.id, campi);
          Object.assign(esistente, agg);
          onFatto('Giorno fisso salvato');
        } else {
          const creato = await createRecurrence(state.teamProfile.id, state.activeSectorId, campi);
          state.trainingRecurrences.push(creato);
          onFatto('Giorno fisso aggiunto');
        }
      }}
    >
      <Campo etichetta="Giorno della settimana">
        <Scelta value={giorno} onChange={e => setGiorno(e.target.value)}>
          {WEEKDAY_LABELS.map((n, i) => <option key={i} value={String(i)}>{n}</option>)}
        </Scelta>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Inizio">
          <Testo value={inizio} onChange={e => setInizio(e.target.value)} placeholder="18:30" />
        </Campo>
        <Campo etichetta="Fine">
          <Testo value={fine} onChange={e => setFine(e.target.value)} placeholder="20:00" />
        </Campo>
      </div>
      <Campo
        etichetta="Luogo"
        aiuto="Scrivilo sempre allo stesso modo: è così che l’app si accorge se due categorie prenotano la stessa palestra."
      >
        <Testo value={luogo} onChange={e => setLuogo(e.target.value)} placeholder="Palestra Comunale" />
      </Campo>
      <Spunta etichetta="Attivo" checked={attivo} onChange={e => setAttivo(e.target.checked)} />
      {!attivo && (
        <p className="-mt-1 text-[12.5px] leading-relaxed text-tenue">
          Spento non genera più niente. Gli allenamenti già creati restano dove sono.
        </p>
      )}
    </Modulo>
  );
}

function ProgrammiFissi({ puoiModificare, onChiudi, onCambiato }) {
  const [modulo, setModulo] = useState(null);       // null | {} | ricorrenza
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [future, setFuture] = useState(null);       // quante occorrenze future ne sono nate
  const [ancheFuture, setAncheFuture] = useState(true);

  // La settimana comincia di lunedì: domenica sta in fondo, non in cima.
  const ordine = (n) => (n === 0 ? 7 : n);
  const elenco = [...state.trainingRecurrences].sort((a, b) => ordine(a.weekday) - ordine(b.weekday));

  async function chiediRimozione(r) {
    setDaRimuovere(r);
    setFuture(null);
    setAncheFuture(true);
    try { setFuture(await contaOccorrenzeFuture(r.id, oggiISO())); }
    catch (e) { setFuture(0); }
  }

  return (
    <>
      <Finestra
        titolo="Giorni fissi"
        sotto="Gli allenamenti che si ripetono ogni settimana. Da qui nascono da soli, otto settimane avanti."
        onChiudi={onChiudi}
        azioni={puoiModificare
          ? <Pulsante variante="primario" className="w-full" onClick={() => setModulo({})}>+ Giorno fisso</Pulsante>
          : null}
      >
        {elenco.length === 0 ? (
          <Vuoto>
            Nessun giorno fisso. Impostandone uno — «il martedì alle 18:30» — gli
            allenamenti delle prossime otto settimane compaiono da soli.
          </Vuoto>
        ) : (
          <div className="space-y-2">
            {elenco.map(r => (
              <Pannello key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[14px] font-semibold">{WEEKDAY_LABELS[r.weekday]}</span>
                    {r.active === false && (
                      <span className="shrink-0 rounded-full bg-pannello/14 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-etichetta text-tenue">
                        spento
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12.5px] text-tenue">
                    <span>{r.start_time || 'orario da definire'}{r.end_time ? '–' + r.end_time : ''}</span>
                    {r.location && <span className="truncate">{r.location}</span>}
                  </div>
                </div>
                {puoiModificare && (
                  <div className="flex shrink-0 items-center gap-1">
                    <AzioneRiga etichetta="Modifica" onClick={() => setModulo(r)}><Matita /></AzioneRiga>
                    <AzioneRiga etichetta="Togli" pericolo onClick={() => chiediRimozione(r)}><Croce /></AzioneRiga>
                  </div>
                )}
              </Pannello>
            ))}
          </div>
        )}
      </Finestra>

      {modulo && (
        <ModuloRicorrenza
          esistente={modulo.id ? modulo : null}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { setModulo(null); onCambiato(msg); }}
        />
      )}

      {/* TOGLIERE UN GIORNO FISSO NON E’ UNA SOLA DOMANDA.
          Togliere il martedì e ritrovarsi i martedì ancora in elenco fa dubitare
          di aver premuto il pulsante giusto. Ma cancellarli d'ufficio sarebbe
          peggio: qualcuno potrebbe averli già comunicati alle famiglie, o
          averne spostato uno a mano. Quindi si dice quanti sono e si sceglie.
          Solo i futuri: il passato è successo. */}
      {daRimuovere && (
        <Conferma
          titolo={'Togliere il ' + WEEKDAY_LABELS[daRimuovere.weekday].toLowerCase() + '?'}
          testo={future == null
            ? 'Conto quanti allenamenti futuri ne sono già nati…'
            : (future === 0
                ? 'Non ci sono allenamenti futuri nati da questo programma: si toglie e basta.'
                : future + ' allenamenti futuri sono nati da qui. '
                  + (ancheFuture
                      ? 'Vengono tolti anche quelli.'
                      : 'Quelli restano in calendario: si toglie solo il programma.'))}
          etichetta={!future || !ancheFuture ? 'Togli il programma' : 'Togli tutto'}
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            if (inCampione()) throw new Error('Nell’anteprima con dati di esempio non si cancella niente.');
            if (future > 0 && ancheFuture) {
              const tolti = await rimuoviOccorrenzeFuture(daRimuovere.id, oggiISO());
              const via = new Set(tolti);
              state.trainings = state.trainings.filter(t => !via.has(t.id));
            }
            await removeRecurrence(daRimuovere.id);
            state.trainingRecurrences = state.trainingRecurrences.filter(x => x.id !== daRimuovere.id);
            setDaRimuovere(null);
            onCambiato('Giorno fisso tolto');
          }}
        />
      )}

      {/* La scelta sta fuori dalla conferma perché Conferma non ospita campi.
          Sopra di lei, perché va vista prima di premere. */}
      {daRimuovere && future > 0 && (
        <div className="fixed inset-x-0 bottom-[9rem] z-[90] flex justify-center px-4">
          <button
            type="button"
            onClick={() => setAncheFuture(v => !v)}
            className="rounded-full vetro-alto orlo px-4 py-2 text-[12.5px] font-semibold text-soffuso shadow-lg"
          >
            {ancheFuture
              ? 'Tieni i ' + future + ' allenamenti già creati'
              : 'Togli anche i ' + future + ' allenamenti già creati'}
          </button>
        </div>
      )}
    </>
  );
}
