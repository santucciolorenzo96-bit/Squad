import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { detectIssues, todayISO } from '../utils/issues.js';
import {
  fetchAllPlayers, fetchAllPlayerDocuments, fetchOpenDeadlines,
  fetchOpenCommunications, fetchTrainingsInRange
} from '../api/dashboard.js';
import { fetchAttendanceForTrainings } from '../api/attendance.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Vuoto, Scheletro, Stato, cx } from './ui.jsx';
import { ErroreCaricamento } from './moduli.jsx';
import { IconaSezione } from './icone.jsx';

/* La situazione della società.
 *
 * Le voci si dividono per CATEGORIA, non per gravità. "Da risolvere", "da
 * sistemare", "da controllare" sono sinonimi: dividere per quelli non aiuta
 * nessuno a capire di chi è il problema. Chi guarda l'Under 15 vuole i problemi
 * dell'Under 15.
 *
 * Quello che non appartiene a nessuna categoria — sponsor, movimenti non legati
 * a un atleta, palestre contese fra due squadre — sta sotto «Società».
 */

const GIORNI_INDIETRO = 30;
const GIORNI_AVANTI = 30;

function scostaISO(giorni) {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

const TONO = { critical: 'fermo', warning: 'attesa' };

export function Situazione({ onSezione }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setDati({ issues: [], finanzaBloccata: false }); return; }

    (async () => {
      const teamId = state.teamProfile.id;
      const hasFinance = !!state.currentUser.finance_role;
      try {
        const [players, documents, communications, trainings] = await Promise.all([
          fetchAllPlayers(teamId),
          fetchAllPlayerDocuments(teamId),
          fetchOpenCommunications(teamId),
          fetchTrainingsInRange(teamId, scostaISO(-GIORNI_INDIETRO), scostaISO(GIORNI_AVANTI))
        ]);
        const attendance = await fetchAttendanceForTrainings(trainings.map(t => t.id));

        // La finanza ha autorizzazioni proprie e più fini dei ruoli: se non
        // passano, tutti gli altri controlli restano validi e vanno mostrati.
        let deadlines = [];
        let finanzaBloccata = false;
        if (hasFinance) {
          try { deadlines = await fetchOpenDeadlines(teamId); }
          catch (e) { finanzaBloccata = true; }
        }

        if (!vivo) return;
        setDati({
          issues: detectIssues({
            today: todayISO(), players, documents, deadlines, communications,
            trainings, attendance, sponsors: state.financeSponsors,
            sectors: state.sectors, hasFinance
          }),
          finanzaBloccata
        });
      } catch (e) {
        if (vivo) setErrore(e);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (errore) return <ErroreCaricamento cosa="la situazione della società" errore={errore} />;

  if (!dati) {
    return (
      <div className="sezioni">
        <Titolo sopra="Società">Situazione</Titolo>
        <Scheletro righe={4} />
      </div>
    );
  }

  // Ogni voce porta la propria categoria: si raggruppa per quella, e i gruppi
  // seguono l'ordine dei settori, con Società in fondo.
  const perSettore = new Map();
  dati.issues.forEach(problema => {
    (problema.items || []).forEach(voce => {
      const k = voce.sectorId || '__societa__';
      if (!perSettore.has(k)) perSettore.set(k, []);
      perSettore.get(k).push({ ...voce, severity: problema.severity, tipo: problema.summary });
    });
  });

  const ordine = [
    ...state.sectors.map(s => ({ id: s.id, nome: s.name })),
    { id: '__societa__', nome: 'Società' }
  ].filter(g => perSettore.has(g.id));

  const totale = dati.issues.reduce((n, i) => n + (i.items || []).length, 0);

  return (
    <div className="sezioni">
      <Titolo
        sopra="Società"
        azione={totale > 0
          ? <span className="shrink-0 text-[12.5px] text-tenue">{totale} da sistemare</span>
          : null}
      >
        Situazione
      </Titolo>

      {dati.finanzaBloccata && (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[12.5px] leading-relaxed text-ambra">
            Le scadenze economiche non sono state lette: il tuo accesso alla finanza non le comprende.
            Tutto il resto qui sotto è completo.
          </p>
        </Pannello>
      )}

      {totale === 0 ? (
        <Vuoto>
          Niente da sistemare. Certificati, tesseramenti, convocazioni, presenze e scadenze
          risultano tutti a posto.
        </Vuoto>
      ) : (
        ordine.map(gruppo => {
          const voci = perSettore.get(gruppo.id);
          return (
            <div key={gruppo.id} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <Etichetta>{gruppo.nome}</Etichetta>
                <span className="text-[11.5px] text-tenue">{voci.length}</span>
              </div>
              <Pannello className="overflow-hidden">
                {voci.map((v, i) => (
                  <div
                    key={i}
                    className={cx(
                      'relative flex items-start gap-3 px-4 py-3 sm:px-5',
                      i > 0 && 'border-t border-bordo/6'
                    )}
                  >
                    <span className={cx('absolute inset-y-0 left-0 w-0.5',
                      v.severity === 'critical' ? 'bg-rosso' : 'bg-ambra')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-tight">{v.label}</div>
                      {v.sub && <div className="mt-1 text-[12px] leading-snug text-tenue">{v.sub}</div>}
                    </div>
                    <Stato tono={TONO[v.severity] || 'attesa'}>{v.tipo}</Stato>
                  </div>
                ))}
              </Pannello>
            </div>
          );
        })
      )}
    </div>
  );
}
