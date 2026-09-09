import React, { useState } from 'react';
import { state } from '../state.js';
import { createEntry, cancelEntry } from '../api/financeEntries.js';
import { createPayment } from '../api/financePayments.js';
import { canManageFinance } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Vuoto, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Scelta, Interruttore, useAvviso } from './moduli.jsx';
import { euro, euroPreciso, Avanzamento } from './grafici.jsx';
import { Chevron } from './icone.jsx';

/* Movimenti.
 *
 * Entrate, uscite e scadenze in un posto solo, perché sono la stessa cosa
 * guardata da tre angoli: un movimento con una scadenza È una scadenza finché
 * non viene saldato.
 *
 * Ogni riga porta la propria barra di avanzamento. "1.200 euro" non dice se
 * sono stati incassati: la barra sì, e senza aprire niente.
 *
 * Le scadenze non sono un elenco per data: sono raggruppate per urgenza —
 * scadute, questa settimana, questo mese, più avanti. Una data da sola
 * costringe a fare il conto a mente ogni volta.
 */

const oggiISO = () => new Date().toISOString().slice(0, 10);

const STATI = {
  previsto: { label: 'Previsto', tono: 'neutro' },
  scaduto: { label: 'Scaduto', tono: 'fermo' },
  parzialmente_incassato: { label: 'Parziale', tono: 'attesa' },
  parzialmente_pagato: { label: 'Parziale', tono: 'attesa' },
  incassato: { label: 'Incassato', tono: 'buono' },
  pagato: { label: 'Pagato', tono: 'buono' },
  annullato: { label: 'Annullato', tono: 'neutro' }
};

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function giorniA(iso) {
  return Math.round((new Date(iso + 'T00:00:00') - new Date(oggiISO() + 'T00:00:00')) / 86400000);
}

export function Movimenti({ dati, onRicarica }) {
  const [vista, setVista] = useState('scadenze');
  const [modulo, setModulo] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [daAnnullare, setDaAnnullare] = useState(null);
  const avvisa = useAvviso();

  const puoiGestire = canManageFinance(state.currentUser);
  const { entrate, uscite, scadenze } = dati;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Interruttore
          valore={vista}
          onCambia={setVista}
          voci={[
            { id: 'scadenze', testo: 'Aperte', conteggio: scadenze.length },
            { id: 'income', testo: 'Entrate', conteggio: entrate.length },
            { id: 'expense', testo: 'Uscite', conteggio: uscite.length }
          ]}
        />
        {puoiGestire && vista !== 'scadenze' && (
          <Pulsante variante="primario" onClick={() => setModulo({ kind: vista })}>
            + {vista === 'income' ? 'Entrata' : 'Uscita'}
          </Pulsante>
        )}
      </div>

      {vista === 'scadenze' ? (
        <Scadenze
          voci={scadenze}
          puoiGestire={puoiGestire}
          onPaga={setPagamento}
        />
      ) : (
        <ElencoMovimenti
          voci={vista === 'income' ? entrate : uscite}
          kind={vista}
          puoiGestire={puoiGestire}
          onPaga={setPagamento}
          onAnnulla={setDaAnnullare}
        />
      )}

      {modulo && (
        <ModuloMovimento
          kind={modulo.kind}
          onChiudi={() => setModulo(null)}
          onFatto={() => { onRicarica(); avvisa('Movimento registrato'); }}
        />
      )}

      {pagamento && (
        <ModuloPagamento
          entry={pagamento}
          conti={dati.conti}
          onChiudi={() => setPagamento(null)}
          onFatto={() => { onRicarica(); avvisa(pagamento.kind === 'income' ? 'Incasso registrato' : 'Pagamento registrato'); }}
        />
      )}

      {daAnnullare && (
        <Conferma
          titolo="Annullare il movimento?"
          testo={`«${daAnnullare.description}» resta in archivio ma smette di contare nei totali. Gli incassi o i pagamenti già registrati vanno annullati a parte.`}
          etichetta="Annulla il movimento"
          onChiudi={() => setDaAnnullare(null)}
          onConferma={async () => {
            await cancelEntry(daAnnullare.id, 'Annullato dall’interfaccia');
            onRicarica();
            avvisa('Movimento annullato');
          }}
        />
      )}
    </div>
  );
}

/* ================================================================ scadenze */
const FASCE = [
  { id: 'scadute', titolo: 'Scadute', nota: 'in ritardo', tono: 'fermo', test: (g) => g < 0 },
  { id: 'settimana', titolo: 'Entro sette giorni', nota: null, tono: 'attesa', test: (g) => g >= 0 && g <= 7 },
  { id: 'mese', titolo: 'Entro il mese', nota: null, tono: 'neutro', test: (g) => g > 7 && g <= 31 },
  { id: 'dopo', titolo: 'Più avanti', nota: null, tono: 'neutro', test: (g) => g > 31 }
];

function Scadenze({ voci, puoiGestire, onPaga }) {
  if (voci.length === 0) {
    return <Vuoto>Nessuna partita aperta: tutto quello che era previsto risulta incassato o pagato.</Vuoto>;
  }

  return (
    <div className="space-y-5">
      {FASCE.map(f => {
        const dentro = voci.filter(e => f.test(giorniA(e.due_date)))
          .sort((a, b) => a.due_date.localeCompare(b.due_date));
        if (dentro.length === 0) return null;
        const somma = dentro.reduce((s, e) => s + ((e._status && e._status.residual_amount) || 0), 0);
        return (
          <div key={f.id}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <Etichetta className={f.tono === 'fermo' ? '!text-rosso' : ''}>{f.titolo}</Etichetta>
              <span className="text-[12.5px] font-semibold text-soffuso">{euro(somma)}</span>
            </div>
            <Pannello className="overflow-hidden">
              {dentro.map((e, i) => (
                <RigaMovimento
                  key={e.id}
                  e={e}
                  primo={i === 0}
                  mostraScadenza
                  puoiGestire={puoiGestire}
                  onPaga={onPaga}
                />
              ))}
            </Pannello>
          </div>
        );
      })}
    </div>
  );
}

/* =============================================================== movimenti */
function ElencoMovimenti({ voci, kind, puoiGestire, onPaga, onAnnulla }) {
  if (voci.length === 0) {
    return (
      <Vuoto>
        Nessun{kind === 'income' ? 'a entrata registrata' : 'a uscita registrata'}.
        {puoiGestire && ' Un movimento ha una categoria, un importo e una data di competenza; la scadenza è facoltativa.'}
      </Vuoto>
    );
  }
  return (
    <Pannello className="overflow-hidden">
      {voci.map((e, i) => (
        <RigaMovimento
          key={e.id}
          e={e}
          primo={i === 0}
          puoiGestire={puoiGestire}
          onPaga={onPaga}
          onAnnulla={onAnnulla}
        />
      ))}
    </Pannello>
  );
}

function RigaMovimento({ e, primo, mostraScadenza, puoiGestire, onPaga, onAnnulla }) {
  const st = e._status || {};
  const stato = STATI[st.status] || STATI.previsto;
  const pagato = st.paid_amount || 0;
  const totale = e.planned_amount || 0;
  const entrata = e.kind === 'income';
  const g = e.due_date ? giorniA(e.due_date) : null;
  const annullato = !!e.cancelled_at;

  return (
    <div className={cx('px-4 py-3.5 sm:px-5', !primo && 'border-t border-bordo/6', annullato && 'opacity-50')}>
      <div className="flex items-start gap-3">
        {/* Il verso del movimento prima di tutto: una freccia si legge senza
            leggere, e distingue un incasso da una spesa a colpo d'occhio. */}
        <span className={cx(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold',
          entrata ? 'bg-verde/14 text-verde' : 'bg-rosso/12 text-rosso'
        )}>
          {entrata ? '↓' : '↑'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold leading-tight">{e.description}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-tenue">
            <span>{(e.finance_categories && e.finance_categories.name) || 'Senza categoria'}</span>
            {e.party_name && <span className="truncate">{e.party_name}</span>}
            {mostraScadenza && e.due_date && (
              <span className={g < 0 ? 'font-semibold text-rosso' : ''}>
                {g < 0 ? `scaduta da ${-g} ${-g === 1 ? 'giorno' : 'giorni'}`
                  : g === 0 ? 'scade oggi'
                  : `scade fra ${g} ${g === 1 ? 'giorno' : 'giorni'}`}
              </span>
            )}
            {!mostraScadenza && <span>{fmtData(e.accrual_date)}</span>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[15px] font-bold leading-none">{euro(totale)}</div>
          {!annullato && pagato > 0 && pagato < totale && (
            <div className="mt-1 text-[11px] text-tenue">{euro(pagato)} su {euro(totale)}</div>
          )}
        </div>
      </div>

      {!annullato && (
        <div className="mt-2.5 flex items-center gap-3">
          <Avanzamento
            fatto={pagato}
            totale={totale}
            tono={st.status === 'scaduto' ? 'rosso' : entrata ? 'verde' : 'ambra'}
            className="flex-1"
          />
          <Stato tono={stato.tono}>{stato.label}</Stato>
          {puoiGestire && pagato < totale && onPaga && (
            <Pulsante className="shrink-0 py-1 text-[11px]" onClick={() => onPaga(e)}>
              {entrata ? 'Incassa' : 'Paga'}
            </Pulsante>
          )}
          {puoiGestire && onAnnulla && (
            <button
              onClick={() => onAnnulla(e)}
              title="Annulla"
              className="shrink-0 rounded-lg px-2 py-1.5 text-tenue hover:bg-rosso/12 hover:text-rosso"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {annullato && e.cancelled_reason && (
        <p className="mt-2 text-[11.5px] text-tenue">Annullato: {e.cancelled_reason}</p>
      )}
    </div>
  );
}

/* ========================================================= nuovo movimento */
function ModuloMovimento({ kind, onChiudi, onFatto }) {
  const entrata = kind === 'income';
  const categorie = (state.financeCategories || []).filter(c => c.kind === kind || !c.kind);
  const centri = state.financeCostCenters || [];
  const esercizi = (state.financeFiscalYears || []).filter(f => !f.closed);

  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState(categorie[0] ? categorie[0].id : '');
  const [competenza, setCompetenza] = useState(oggiISO());
  const [scadenza, setScadenza] = useState('');
  const [esercizio, setEsercizio] = useState(esercizi[0] ? esercizi[0].id : '');
  const [controparte, setControparte] = useState('');
  const [centro, setCentro] = useState(centri[0] ? centri[0].id : '');

  return (
    <Modulo
      titolo={entrata ? 'Nuova entrata' : 'Nuova uscita'}
      sotto="La data di competenza dice a quale periodo appartiene; la scadenza, se c’è, la fa comparire fra le partite aperte."
      etichettaInvia="Registra"
      onChiudi={onChiudi}
      larga
      onInvia={async () => {
        const d = descrizione.trim();
        if (!d) return 'Scrivi una descrizione.';
        const v = parseFloat(String(importo).replace(',', '.'));
        if (!(v > 0)) return 'L’importo deve essere maggiore di zero.';
        if (!categoria) return 'Scegli una categoria. Si creano dalla Configurazione.';
        if (!centro) return 'Scegli un centro di costo. Si creano dalla Configurazione.';
        if (scadenza && scadenza < competenza) {
          return 'La scadenza non può venire prima della data di competenza.';
        }
        await createEntry(state.teamProfile.id, {
          kind,
          category_id: categoria,
          planned_amount: v,
          accrual_date: competenza,
          due_date: scadenza || null,
          description: d,
          party_name: controparte.trim() || null,
          fiscal_year_id: esercizio || null
        }, [{ cost_center_id: centro, amount: v }]);
        onFatto();
      }}
    >
      <Campo etichetta="Descrizione">
        <Testo
          value={descrizione}
          onChange={e => setDescrizione(e.target.value)}
          placeholder={entrata ? 'Quota associativa 2026/27' : 'Affitto palestra dicembre'}
          autoFocus
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Importo">
          <Testo
            inputMode="decimal"
            value={importo}
            onChange={e => setImporto(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="250,00"
          />
        </Campo>
        <Campo etichetta="Categoria">
          <Scelta value={categoria} onChange={e => setCategoria(e.target.value)}>
            {categorie.length === 0 && <option value="">— nessuna creata —</option>}
            {categorie.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Scelta>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Competenza">
          <Data value={competenza} onChange={e => setCompetenza(e.target.value)} />
        </Campo>
        <Campo etichetta="Scadenza" aiuto="Facoltativa. Senza, il movimento non compare fra le partite aperte.">
          <Data value={scadenza} onChange={e => setScadenza(e.target.value)} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Centro di costo">
          <Scelta value={centro} onChange={e => setCentro(e.target.value)}>
            {centri.length === 0 && <option value="">— nessuno creato —</option>}
            {centri.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Scelta>
        </Campo>
        <Campo etichetta="Esercizio">
          <Scelta value={esercizio} onChange={e => setEsercizio(e.target.value)}>
            <option value="">— nessuno —</option>
            {esercizi.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Scelta>
        </Campo>
      </div>

      <Campo etichetta={entrata ? 'Da chi' : 'A chi'} aiuto="Facoltativo: un nome libero, se non è un atleta o un fornitore in elenco.">
        <Testo value={controparte} onChange={e => setControparte(e.target.value)} />
      </Campo>
    </Modulo>
  );
}

/* ============================================================== pagamento */
function ModuloPagamento({ entry, conti, onChiudi, onFatto }) {
  const st = entry._status || {};
  const residuo = st.residual_amount || 0;
  const entrata = entry.kind === 'income';
  const [importo, setImporto] = useState(String(residuo).replace('.', ','));
  const [conto, setConto] = useState(conti[0] ? conti[0].id : '');
  const [quando, setQuando] = useState(oggiISO());

  return (
    <Modulo
      titolo={entrata ? 'Registra un incasso' : 'Registra un pagamento'}
      sotto={`${entry.description} · residuo ${euroPreciso(residuo)}`}
      etichettaInvia="Registra"
      onChiudi={onChiudi}
      onInvia={async () => {
        const v = parseFloat(String(importo).replace(',', '.'));
        if (!(v > 0)) return 'L’importo deve essere maggiore di zero.';
        // Il residuo è calcolato dal database: fermarlo qui evita di dover
        // spiegare dopo perché un movimento risulta pagato al 130%.
        if (v > residuo + 0.005) return `Non puoi registrare più del residuo (${euroPreciso(residuo)}).`;
        if (!conto) return 'Scegli il conto. Si creano dalla Configurazione.';
        await createPayment(state.teamProfile.id, {
          entry_id: entry.id,
          account_id: conto,
          amount: v,
          paid_at: quando
        });
        onFatto();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Importo">
          <Testo
            inputMode="decimal"
            value={importo}
            onChange={e => setImporto(e.target.value.replace(/[^\d.,]/g, ''))}
            className="text-[18px] font-bold"
            autoFocus
          />
        </Campo>
        <Campo etichetta="Data">
          <Data value={quando} onChange={e => setQuando(e.target.value)} />
        </Campo>
      </div>
      <Campo etichetta="Conto" aiuto="È il conto su cui il denaro entra o da cui esce: da lì si aggiorna il saldo.">
        <Scelta value={conto} onChange={e => setConto(e.target.value)}>
          {conti.length === 0 && <option value="">— nessun conto creato —</option>}
          {conti.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Scelta>
      </Campo>
    </Modulo>
  );
}
