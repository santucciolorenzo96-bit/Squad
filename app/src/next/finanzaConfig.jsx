import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { createAccount, updateAccount, removeAccount } from '../api/financeAccounts.js';
import { fetchCategories, createCategory, updateCategory } from '../api/financeCategories.js';
import { fetchCostCenters, createCostCenter, updateCostCenter } from '../api/financeCostCenters.js';
import { fetchSuppliers, createSupplier } from '../api/financeSuppliers.js';
import { fetchSponsors, createSponsor } from '../api/financeSponsors.js';
import { createFiscalYear, closeFiscalYear, reopenFiscalYear } from '../api/financeFiscalYears.js';
import { canManageFinance } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Vuoto, Scheletro, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Scelta, useAvviso } from './moduli.jsx';
import { euro } from './grafici.jsx';

/* Configurazione.
 *
 * Sei anagrafiche che prima erano sei sezioni della barra. Si toccano tre
 * volte l'anno: mettere ciascuna al pari livello di "Entrate" faceva sembrare
 * la finanza sei volte più complicata di quanto sia.
 *
 * Qui sono sei riquadri che si aprono, e uno alla volta: chiuse mostrano
 * quante voci contengono, che è tutto quello che serve sapere fino al momento
 * in cui bisogna metterci mano.
 */

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function Configurazione({ dati, onRicarica }) {
  const [aperto, setAperto] = useState(null);
  const [extra, setExtra] = useState(null);
  const avvisa = useAvviso();
  const puoiGestire = canManageFinance(state.currentUser);

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setExtra({ categorie: [], centri: [], fornitori: [], sponsor: [] }); return; }
    const teamId = state.teamProfile.id;
    Promise.all([
      fetchCategories(teamId).catch(() => []),
      fetchCostCenters(teamId).catch(() => []),
      fetchSuppliers(teamId).catch(() => []),
      fetchSponsors(teamId).catch(() => [])
    ]).then(([categorie, centri, fornitori, sponsor]) => {
      if (!vivo) return;
      state.financeCategories = categorie;
      state.financeCostCenters = centri;
      state.financeSuppliers = fornitori;
      state.financeSponsors = sponsor;
      setExtra({ categorie, centri, fornitori, sponsor });
    });
    return () => { vivo = false; };
  }, []);

  if (!extra) return <Scheletro righe={4} />;

  const sezioni = [
    { id: 'conti', titolo: 'Conti', nota: 'Dove il denaro entra ed esce', voci: dati.conti },
    { id: 'categorie', titolo: 'Categorie', nota: 'Di che natura è un movimento', voci: extra.categorie },
    { id: 'centri', titolo: 'Centri di costo', nota: 'A quale attività va imputato', voci: extra.centri },
    { id: 'fornitori', titolo: 'Fornitori', nota: 'A chi si paga', voci: extra.fornitori },
    { id: 'sponsor', titolo: 'Sponsor', nota: 'Chi sostiene la società', voci: extra.sponsor },
    { id: 'esercizi', titolo: 'Esercizi', nota: 'I periodi contabili', voci: dati.esercizi }
  ];

  return (
    <div className="space-y-3">
      {/* Un avviso che serve davvero: senza conto, categoria e centro non si
          può registrare niente, e scoprirlo dentro il modulo è tardi. */}
      {(dati.conti.length === 0 || extra.categorie.length === 0 || extra.centri.length === 0) && (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[12.5px] leading-relaxed text-ambra">
            Per registrare un movimento servono almeno <b>un conto</b>, <b>una categoria</b> e{' '}
            <b>un centro di costo</b>. Finché mancano, Movimenti non può salvare niente.
          </p>
        </Pannello>
      )}

      {sezioni.map(s => {
        const on = aperto === s.id;
        return (
          <Pannello key={s.id} className="overflow-hidden">
            <button
              onClick={() => setAperto(on ? null : s.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-pannello/8 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-tight">{s.titolo}</div>
                <div className="text-[11.5px] text-tenue">{s.nota}</div>
              </div>
              <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
                s.voci.length === 0 ? 'bg-ambra/16 text-ambra' : 'bg-pannello/12 text-soffuso')}>
                {s.voci.length}
              </span>
              <span className={cx('shrink-0 text-tenue transition-transform', on && 'rotate-90')}>›</span>
            </button>

            {on && (
              <div className="border-t border-bordo/8 px-4 py-4 sm:px-5">
                <Contenuto
                  id={s.id}
                  voci={s.voci}
                  saldi={dati.saldi}
                  puoiGestire={puoiGestire}
                  onRicarica={onRicarica}
                  onExtra={setExtra}
                  avvisa={avvisa}
                />
              </div>
            )}
          </Pannello>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- contenuto */
function Contenuto({ id, voci, saldi, puoiGestire, onRicarica, onExtra, avvisa }) {
  const [modulo, setModulo] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState(null);

  const vuoto = {
    conti: 'Nessun conto. Un conto è una cassa o un conto corrente: è lì che il saldo si muove.',
    categorie: 'Nessuna categoria. Servono a dire di che natura è un movimento: quote, affitti, arbitraggi.',
    centri: 'Nessun centro di costo. Servono a dire a quale attività imputare una spesa: una categoria, un evento.',
    fornitori: 'Nessun fornitore.',
    sponsor: 'Nessuno sponsor.',
    esercizi: 'Nessun esercizio. È il periodo contabile: di norma va da luglio a giugno.'
  }[id];

  async function ricaricaAnagrafiche() {
    const teamId = state.teamProfile.id;
    const [categorie, centri, fornitori, sponsor] = await Promise.all([
      fetchCategories(teamId).catch(() => []),
      fetchCostCenters(teamId).catch(() => []),
      fetchSuppliers(teamId).catch(() => []),
      fetchSponsors(teamId).catch(() => [])
    ]);
    state.financeCategories = categorie;
    state.financeCostCenters = centri;
    state.financeSuppliers = fornitori;
    state.financeSponsors = sponsor;
    onExtra({ categorie, centri, fornitori, sponsor });
  }

  return (
    <>
      {voci.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-tenue">{vuoto}</p>
      ) : (
        <div className="space-y-1.5">
          {voci.map(v => (
            <div key={v.id} className="flex items-center gap-3 rounded-lg bg-pannello/6 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{v.name}</span>

              {id === 'conti' && (
                <span className={cx('shrink-0 text-[13px] font-semibold',
                  (saldi[v.id] ?? 0) < 0 ? 'text-rosso' : 'text-soffuso')}>
                  {euro(saldi[v.id] ?? 0)}
                </span>
              )}
              {id === 'categorie' && (
                <span className={cx('shrink-0 text-[11px] font-bold uppercase tracking-etichetta',
                  v.kind === 'income' ? 'text-verde' : 'text-rosso')}>
                  {v.kind === 'income' ? 'entrata' : 'uscita'}
                </span>
              )}
              {id === 'esercizi' && (
                <>
                  <span className="shrink-0 text-[11.5px] text-tenue">
                    {fmtData(v.start_date)} → {fmtData(v.end_date)}
                  </span>
                  <Stato tono={v.closed ? 'neutro' : 'buono'}>{v.closed ? 'Chiuso' : 'Aperto'}</Stato>
                  {puoiGestire && (
                    <Pulsante
                      className="shrink-0 py-1 text-[11px]"
                      onClick={async () => {
                        try {
                          if (v.closed) await reopenFiscalYear(v.id);
                          else await closeFiscalYear(v.id, state.currentUser.id);
                          onRicarica();
                          avvisa(v.closed ? 'Esercizio riaperto' : 'Esercizio chiuso');
                        } catch (e) {
                          avvisa((e && e.message) || 'Non riuscita.', 'errore');
                        }
                      }}
                    >
                      {v.closed ? 'Riapri' : 'Chiudi'}
                    </Pulsante>
                  )}
                </>
              )}

              {id === 'conti' && puoiGestire && (
                <button
                  onClick={() => setDaRimuovere(v)}
                  title="Elimina"
                  className="shrink-0 rounded-lg px-2 py-1 text-tenue hover:bg-rosso/12 hover:text-rosso"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {puoiGestire && (
        <div className="mt-3 flex justify-end">
          <Pulsante variante="primario" className="py-1.5 text-[11.5px]" onClick={() => setModulo(true)}>
            + Aggiungi
          </Pulsante>
        </div>
      )}

      {modulo && (
        <ModuloAnagrafica
          id={id}
          onChiudi={() => setModulo(false)}
          onFatto={async () => {
            if (id === 'conti' || id === 'esercizi') onRicarica();
            else await ricaricaAnagrafiche();
            avvisa('Salvato');
          }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Eliminare il conto?"
          testo={`«${daRimuovere.name}» viene eliminato. Non è possibile se ci sono movimenti registrati su di lui.`}
          etichetta="Elimina"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => { await removeAccount(daRimuovere.id); onRicarica(); avvisa('Conto eliminato'); }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- moduli */
function ModuloAnagrafica({ id, onChiudi, onFatto }) {
  const anno = new Date().getFullYear();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(id === 'categorie' ? 'expense' : 'cassa');
  const [inizio, setInizio] = useState(`${anno}-07-01`);
  const [fine, setFine] = useState(`${anno + 1}-06-30`);

  const titoli = {
    conti: 'Nuovo conto', categorie: 'Nuova categoria', centri: 'Nuovo centro di costo',
    fornitori: 'Nuovo fornitore', sponsor: 'Nuovo sponsor', esercizi: 'Nuovo esercizio'
  };

  return (
    <Modulo
      titolo={titoli[id]}
      etichettaInvia="Crea"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Inserisci un nome.';
        const teamId = state.teamProfile.id;
        if (id === 'conti') await createAccount(teamId, { name: n, kind: tipo });
        else if (id === 'categorie') await createCategory(teamId, { name: n, kind: tipo });
        else if (id === 'centri') await createCostCenter(teamId, { name: n });
        else if (id === 'fornitori') await createSupplier(teamId, { name: n });
        else if (id === 'sponsor') await createSponsor(teamId, { name: n });
        else if (id === 'esercizi') {
          if (fine <= inizio) return 'La fine deve venire dopo l’inizio.';
          await createFiscalYear(teamId, { name: n, start_date: inizio, end_date: fine });
        }
        onFatto();
      }}
    >
      <Campo etichetta="Nome">
        <Testo
          value={nome}
          onChange={e => setNome(e.target.value)}
          autoFocus
          placeholder={{
            conti: 'Cassa contanti', categorie: 'Affitto palestra', centri: 'Under 15',
            fornitori: 'Palestra Comunale srl', sponsor: 'Bar Centrale',
            esercizi: `${anno}/${String(anno + 1).slice(2)}`
          }[id]}
        />
      </Campo>

      {id === 'conti' && (
        <Campo etichetta="Tipo">
          <Scelta value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="cassa">Cassa contanti</option>
            <option value="banca">Conto corrente</option>
          </Scelta>
        </Campo>
      )}

      {id === 'categorie' && (
        <Campo etichetta="Natura" aiuto="Una categoria vale o per le entrate o per le uscite, non per entrambe.">
          <Scelta value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="expense">Uscita</option>
            <option value="income">Entrata</option>
          </Scelta>
        </Campo>
      )}

      {id === 'esercizi' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Inizio"><Data value={inizio} onChange={e => setInizio(e.target.value)} /></Campo>
          <Campo etichetta="Fine"><Data value={fine} onChange={e => setFine(e.target.value)} /></Campo>
        </div>
      )}
    </Modulo>
  );
}
