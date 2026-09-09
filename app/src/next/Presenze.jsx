import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchAttendanceForTrainings } from '../api/attendance.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Dato, Vuoto, Scheletro, Avatar, cx } from './ui.jsx';
import { Interruttore, ErroreCaricamento } from './moduli.jsx';
import { IconaSezione } from './icone.jsx';

/* Le presenze.
 *
 * Si registrano dagli allenamenti, qui si leggono. Contano solo gli allenamenti
 * GIÀ SVOLTI e per cui qualcuno ha effettivamente rilevato: un allenamento
 * senza rilevazione non è "tutti assenti", è un dato che non esiste, e
 * confonderli farebbe crollare le percentuali di chi non ha colpe.
 *
 * La percentuale è colorata a soglie perché è l'unico numero che si guarda
 * scorrendo: sotto il 60% qualcosa non va, sopra l'85% va bene.
 */

const PERIODI = [
  { id: 'week', testo: 'Settimana', giorni: 7 },
  { id: 'month', testo: 'Mese', giorni: 30 },
  { id: 'season', testo: 'Stagione', giorni: null }
];

const oggiISO = () => new Date().toISOString().slice(0, 10);

function inizioPeriodo(giorni) {
  if (giorni == null) return '0000-01-01';
  const d = new Date();
  d.setDate(d.getDate() - giorni);
  return d.toISOString().slice(0, 10);
}

function colorePct(pct) {
  if (pct == null) return 'text-tenue';
  if (pct >= 85) return 'text-verde';
  if (pct >= 60) return 'text-ambra';
  return 'text-rosso';
}

export function Presenze() {
  const [periodo, setPeriodo] = useState(state.presenzePeriod || 'month');
  const [presenze, setPresenze] = useState(null);
  const [errore, setErrore] = useState(null);

  const svolti = state.trainings.filter(t => t.date <= oggiISO());

  useEffect(() => {
    let vivo = true;
    setErrore(null);
    if (svolti.length === 0) { setPresenze([]); return; }
    if (inCampione()) { setPresenze([]); return; }
    setPresenze(null);
    fetchAttendanceForTrainings(svolti.map(t => t.id))
      .then(d => { if (vivo) setPresenze(d); })
      .catch(e => { if (vivo) setErrore(e); });
    return () => { vivo = false; };
  }, [state.activeSectorId, state.trainings.length]);

  const def = PERIODI.find(p => p.id === periodo) || PERIODI[1];
  const da = inizioPeriodo(def.giorni);
  const nelPeriodo = svolti.filter(t => t.date >= da);
  const idsPeriodo = new Set(nelPeriodo.map(t => t.id));

  if (errore) return <ErroreCaricamento cosa="le presenze" errore={errore} />;

  if (presenze === null) {
    return (
      <div className="sezioni">
        <Titolo sopra="Categoria">Presenze</Titolo>
        <Scheletro righe={4} />
      </div>
    );
  }

  const rilevate = presenze.filter(a => idsPeriodo.has(a.training_id));

  // Un giocatore per riga, contando solo ciò che è stato davvero rilevato.
  const perGiocatore = {};
  state.roster.forEach(p => {
    perGiocatore[p.id] = { p, present: 0, absent: 0, excused: 0, rilevati: 0 };
  });
  rilevate.forEach(a => {
    const r = perGiocatore[a.player_id];
    if (!r) return;
    if (a.status === 'present') r.present++;
    else if (a.status === 'absent') r.absent++;
    else if (a.status === 'excused') r.excused++;
    else return;
    r.rilevati++;
  });

  const righe = Object.values(perGiocatore)
    .map(r => ({ ...r, pct: r.rilevati ? Math.round(r.present / r.rilevati * 100) : null }))
    .sort((a, b) => (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct));

  const totRilevati = righe.reduce((s, r) => s + r.rilevati, 0);
  const totPresenti = righe.reduce((s, r) => s + r.present, 0);
  const media = totRilevati ? Math.round(totPresenti / totRilevati * 100) : null;
  const migliore = righe.find(r => r.pct != null) || null;

  // Gli allenamenti del periodo per cui non ha rilevato nessuno: è un numero
  // che serve, perché spiega perché le percentuali sono quelle.
  const conRilevazione = new Set(rilevate.map(a => a.training_id));
  const senzaRilevazione = nelPeriodo.filter(t => !conRilevazione.has(t.id)).length;

  return (
    <div className="sezioni">
      <Titolo sopra="Categoria">Presenze</Titolo>

      <Interruttore
        valore={periodo}
        onCambia={(id) => { setPeriodo(id); state.presenzePeriod = id; }}
        voci={PERIODI.map(p => ({ id: p.id, testo: p.testo }))}
      />

      {nelPeriodo.length === 0 ? (
        <Vuoto>
          Nessun allenamento svolto in questo periodo. Le presenze si registrano dalla scheda
          di ogni allenamento, e da lì arrivano qui.
        </Vuoto>
      ) : (
        <>
          <div className="grid grid-cols-2 schede lg:grid-cols-4">
            <Dato
              etichetta="Presenza media"
              valore={media == null ? '—' : `${media}%`}
              icona={<IconaSezione id="presenze" dim={26} />}
            />
            <Dato etichetta="Allenamenti" valore={nelPeriodo.length} sotto="svolti nel periodo" />
            <Dato
              etichetta="Senza rilevazione"
              valore={senzaRilevazione}
              tono={senzaRilevazione ? 'attesa' : undefined}
              sotto={senzaRilevazione ? 'non contano nelle medie' : 'rilevati tutti'}
            />
            <Dato
              etichetta="Più costante"
              valore={migliore && migliore.pct != null ? `${migliore.pct}%` : '—'}
              sotto={migliore ? migliore.p.name : null}
            />
          </div>

          {totRilevati === 0 ? (
            <Vuoto>
              Nessuna presenza rilevata in questo periodo: i {nelPeriodo.length} allenamenti
              ci sono, ma nessuno ha segnato chi c’era.
            </Vuoto>
          ) : (
            <>
              <Etichetta>Per giocatore</Etichetta>
              <Pannello className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-bordo/10">
                        <th className="etichetta px-5 py-3.5">Giocatore</th>
                        <th className="etichetta px-3 py-3.5 text-right">Rilevati</th>
                        <th className="etichetta px-3 py-3.5 text-right">Presente</th>
                        <th className="etichetta px-3 py-3.5 text-right">Assente</th>
                        <th className="etichetta px-3 py-3.5 text-right">Giust.</th>
                        <th className="etichetta px-5 py-3.5 text-right">Presenza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {righe.map(r => (
                        <tr key={r.p.id} className="border-b border-bordo/6 last:border-b-0 hover:bg-pannello/8">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="w-6 shrink-0 text-right text-[13px] text-tenue">{r.p.number}</span>
                              <Avatar nome={r.p.name} dim={28} />
                              <span className="truncate text-[13.5px] font-semibold">{r.p.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] text-tenue">{r.rilevati}</td>
                          <td className="px-3 py-3 text-right text-[13px] text-verde">{r.present}</td>
                          <td className="px-3 py-3 text-right text-[13px] text-rosso">{r.absent}</td>
                          <td className="px-3 py-3 text-right text-[13px] text-ambra">{r.excused}</td>
                          <td className={cx('px-5 py-3 text-right text-[15px] font-bold', colorePct(r.pct))}>
                            {r.pct == null ? '—' : `${r.pct}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Pannello>
              <p className="text-[11.5px] leading-relaxed text-tenue">
                Contano solo gli allenamenti già svolti per cui è stata fatta la rilevazione.
                Un allenamento senza rilevazione non è «tutti assenti»: è un dato che non esiste,
                e contarlo abbasserebbe le percentuali di chi non ha colpe.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
