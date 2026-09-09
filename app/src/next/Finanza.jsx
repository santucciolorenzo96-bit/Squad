import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchAccounts, fetchAccountBalances } from '../api/financeAccounts.js';
import { fetchEntries, fetchDeadlines } from '../api/financeEntries.js';
import { fetchFiscalYears } from '../api/financeFiscalYears.js';
import { canManageFinance } from '../utils/permissions.js';
import { inCampione, FINANZA_CAMPIONE } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, cx } from './ui.jsx';
import { Interruttore, ErroreCaricamento, useAvviso } from './moduli.jsx';
import { IconaSezione, Chevron } from './icone.jsx';
import { euro, euroPreciso, Avanzamento, Impilata, ColonneAffrontate, Anello, COLORI_FETTA, raggruppa } from './grafici.jsx';
import { Movimenti } from './finanzaMovimenti.jsx';
import { Configurazione } from './finanzaConfig.jsx';

/* La finanza.
 *
 * Nove sotto-sezioni erano troppe: per sapere se la società sta in piedi si
 * finiva a saltare fra Conti, Entrate, Uscite e Scadenze rimettendo insieme i
 * numeri a mente. Ora sono tre.
 *
 *   Quadro          la risposta alla domanda vera: come stiamo.
 *   Movimenti       entrate, uscite e scadenze, dove si lavora.
 *   Configurazione  conti, categorie, centri, fornitori, sponsor, esercizi:
 *                   si toccano tre volte l'anno e non meritano una sezione
 *                   ciascuna nella barra.
 *
 * E il quadro non è una griglia di numeri: i numeri da soli non dicono se
 * 4.200 euro da incassare siano tanti o pochi. Ogni grandezza qui ha una
 * lunghezza proporzionale accanto, così il confronto lo fa l'occhio.
 */

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const oggiISO = () => new Date().toISOString().slice(0, 10);

export function Finanza() {
  const [vista, setVista] = useState(state.financeSubTab === 'config' ? 'config' : (state.financeSubTab === 'movimenti' ? 'movimenti' : 'quadro'));
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);

  function carica() {
    if (inCampione()) { setDati(FINANZA_CAMPIONE()); return; }
    setDati(null);
    setErrore(null);
    const teamId = state.teamProfile.id;
    Promise.all([
      fetchAccounts(teamId),
      fetchAccountBalances(teamId),
      fetchEntries(teamId, 'income'),
      fetchEntries(teamId, 'expense'),
      fetchDeadlines(teamId),
      fetchFiscalYears(teamId)
    ]).then(([conti, saldi, entrate, uscite, scadenze, esercizi]) => {
      state.financeAccounts = conti;
      state.financeAccountBalances = saldi;
      state.financeFiscalYears = esercizi;
      setDati({ conti, saldi, entrate, uscite, scadenze, esercizi });
    }).catch(setErrore);
  }
  useEffect(carica, []);

  function cambia(v) { setVista(v); state.financeSubTab = v; }

  if (errore) return <ErroreCaricamento cosa="la finanza" errore={errore} onRiprova={carica} />;

  return (
    <div className="sezioni">
      <Titolo sopra="Società">Finanza</Titolo>

      <Interruttore
        valore={vista}
        onCambia={cambia}
        voci={[
          { id: 'quadro', testo: 'Quadro' },
          { id: 'movimenti', testo: 'Movimenti' },
          { id: 'config', testo: 'Configurazione' }
        ]}
      />

      {!dati ? <Scheletro righe={5} />
        : vista === 'quadro' ? <Quadro dati={dati} onVista={cambia} />
        : vista === 'movimenti' ? <Movimenti dati={dati} onRicarica={carica} />
        : <Configurazione dati={dati} onRicarica={carica} />}
    </div>
  );
}

/* ==================================================================== quadro */
function Quadro({ dati, onVista }) {
  const { conti, saldi, entrate, uscite, scadenze } = dati;
  const oggi = oggiISO();

  const saldoTotale = conti.reduce((s, c) => s + (saldi[c.id] ?? 0), 0);

  const vive = (arr) => arr.filter(e => !e.cancelled_at);
  const incassato = vive(entrate).reduce((s, e) => s + ((e._status && e._status.paid_amount) || 0), 0);
  const pagato = vive(uscite).reduce((s, e) => s + ((e._status && e._status.paid_amount) || 0), 0);
  const previstoIn = vive(entrate).reduce((s, e) => s + (e.planned_amount || 0), 0);
  const previstoOut = vive(uscite).reduce((s, e) => s + (e.planned_amount || 0), 0);

  const daIncassare = scadenze.filter(e => e.kind === 'income');
  const daPagare = scadenze.filter(e => e.kind === 'expense');
  const somma = (arr) => arr.reduce((s, e) => s + ((e._status && e._status.residual_amount) || 0), 0);
  const scadIn = daIncassare.filter(e => e.due_date < oggi);
  const scadOut = daPagare.filter(e => e.due_date < oggi);

  // L'andamento degli ultimi dodici mesi, per data di competenza: è la
  // domanda "quando entrano e quando escono i soldi", non "quanto ho in
  // banca oggi".
  const mesi = [];
  const base = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const chiave = d.toISOString().slice(0, 7);
    mesi.push({
      chiave,
      etichetta: MESI[d.getMonth()],
      entrate: vive(entrate).filter(e => (e.accrual_date || '').startsWith(chiave))
        .reduce((s, e) => s + (e.planned_amount || 0), 0),
      uscite: vive(uscite).filter(e => (e.accrual_date || '').startsWith(chiave))
        .reduce((s, e) => s + (e.planned_amount || 0), 0)
    });
  }
  const conMovimenti = mesi.some(m => m.entrate > 0 || m.uscite > 0);

  const perCategoria = raggruppa(
    Object.values(vive(uscite).reduce((acc, e) => {
      const nome = (e.finance_categories && e.finance_categories.name) || 'Senza categoria';
      acc[nome] = acc[nome] || { nome, valore: 0 };
      acc[nome].valore += e.planned_amount || 0;
      return acc;
    }, {}))
  ).map((f, i) => ({ ...f, colore: COLORI_FETTA[i % COLORI_FETTA.length] }));

  if (conti.length === 0 && entrate.length === 0 && uscite.length === 0) {
    return (
      <Vuoto>
        La finanza è vuota. Si comincia dalla Configurazione: un conto e qualche categoria,
        poi i movimenti si registrano da Movimenti.
      </Vuoto>
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ il saldo */}
      <Pannello alto className="pad-pannello">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Etichetta>Disponibile sui conti</Etichetta>
            <div className={cx('mt-2 text-[clamp(30px,7vw,44px)] font-bold leading-none tracking-tight',
              saldoTotale < 0 ? 'text-rosso' : 'text-testo')}>
              {euro(saldoTotale)}
            </div>
          </div>
          <div className="text-right">
            <Etichetta>Saldo di competenza</Etichetta>
            <div className={cx('mt-2 text-[20px] font-bold leading-none',
              previstoIn - previstoOut < 0 ? 'text-rosso' : 'text-verde')}>
              {euro(previstoIn - previstoOut, { segno: true })}
            </div>
            <p className="mt-1 text-[11px] text-tenue">previsto, non ancora tutto movimentato</p>
          </div>
        </div>

        {conti.length > 0 && (
          <div className="mt-5 space-y-2.5">
            {conti.map(c => {
              const v = saldi[c.id] ?? 0;
              const quota = saldoTotale > 0 ? Math.max(0, v) / saldoTotale : 0;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[12.5px] font-semibold">{c.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-pannello/14">
                    <div
                      className={cx('h-full rounded-full', v < 0 ? 'bg-rosso' : 'bg-gradient-to-r from-blu to-blu2')}
                      style={{ width: Math.max(quota * 100, v !== 0 ? 1.5 : 0) + '%' }}
                    />
                  </div>
                  <span className={cx('w-24 shrink-0 text-right text-[13px] font-semibold',
                    v < 0 ? 'text-rosso' : 'text-soffuso')}>
                    {euro(v)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Pannello>

      {/* -------------------------------------------- incassato / pagato */}
      <div className="grid gap-4 md:grid-cols-2">
        <Pannello className="pad-pannello-stretto">
          <div className="flex items-center justify-between gap-3">
            <Etichetta>Entrate</Etichetta>
            <span className="text-[11.5px] text-tenue">
              {previstoIn > 0 ? Math.round(incassato / previstoIn * 100) : 0}% incassato
            </span>
          </div>
          <div className="mt-2.5 text-[26px] font-bold leading-none text-verde">{euro(incassato)}</div>
          <p className="mt-1 text-[11.5px] text-tenue">su {euro(previstoIn)} previsti</p>
          <Avanzamento fatto={incassato} totale={previstoIn} tono="verde" className="mt-3" />
        </Pannello>

        <Pannello className="pad-pannello-stretto">
          <div className="flex items-center justify-between gap-3">
            <Etichetta>Uscite</Etichetta>
            <span className="text-[11.5px] text-tenue">
              {previstoOut > 0 ? Math.round(pagato / previstoOut * 100) : 0}% pagato
            </span>
          </div>
          <div className="mt-2.5 text-[26px] font-bold leading-none">{euro(pagato)}</div>
          <p className="mt-1 text-[11.5px] text-tenue">su {euro(previstoOut)} previsti</p>
          <Avanzamento fatto={pagato} totale={previstoOut} tono="rosso" className="mt-3" />
        </Pannello>
      </div>

      {/* ------------------------------------------------- da sistemare */}
      {(daIncassare.length > 0 || daPagare.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Aperte
            titolo="Da incassare"
            voci={daIncassare}
            scadute={scadIn}
            totale={somma(daIncassare)}
            scaduto={somma(scadIn)}
            tono="verde"
            onApri={() => onVista('movimenti')}
          />
          <Aperte
            titolo="Da pagare"
            voci={daPagare}
            scadute={scadOut}
            totale={somma(daPagare)}
            scaduto={somma(scadOut)}
            tono="ambra"
            onApri={() => onVista('movimenti')}
          />
        </div>
      )}

      {/* --------------------------------------------------- l'andamento */}
      {conMovimenti && (
        <Pannello className="pad-pannello-stretto">
          <div className="flex items-center gap-2.5">
            <IconaSezione id="finanza" dim={26} />
            <Etichetta>Dodici mesi · entrate sopra, uscite sotto</Etichetta>
          </div>
          <ColonneAffrontate mesi={mesi} className="mt-4" />
          <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
            Per data di competenza, non di pagamento: dice in quali mesi la società impegna
            e incassa, che è la domanda a cui serve rispondere prima di firmare una spesa.
            Le due metà condividono la scala, quindi le altezze si confrontano davvero.
          </p>
        </Pannello>
      )}

      {/* ------------------------------------------------ dove vanno i soldi */}
      {perCategoria.length > 0 && (
        <Pannello className="pad-pannello-stretto">
          <Etichetta>Dove vanno le uscite</Etichetta>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <Anello
              fette={perCategoria}
              centro={
                <div>
                  <div className="text-[16px] font-bold leading-none">{euro(previstoOut)}</div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-etichetta text-tenue">totale</div>
                </div>
              }
            />
            <div className="min-w-[12rem] flex-1 space-y-2">
              {perCategoria.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.colore }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{f.nome}</span>
                  <span className="shrink-0 text-[12.5px] font-semibold">{euro(f.valore)}</span>
                  <span className="w-10 shrink-0 text-right text-[11px] text-tenue">
                    {previstoOut > 0 ? Math.round(f.valore / previstoOut * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Pannello>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ partite aperte */
function Aperte({ titolo, voci, scadute, totale, scaduto, tono, onApri }) {
  const inArrivo = totale - scaduto;
  return (
    <Pannello className="pad-pannello-stretto">
      <div className="flex items-center justify-between gap-3">
        <Etichetta>{titolo}</Etichetta>
        <span className="text-[11.5px] text-tenue">{voci.length} {voci.length === 1 ? 'voce' : 'voci'}</span>
      </div>
      <div className="mt-2.5 text-[26px] font-bold leading-none">{euro(totale)}</div>

      {/* Scaduto e in arrivo nella stessa barra: "4.200 da incassare" non dice
          niente finché non si sa quanto di quello è già in ritardo. */}
      <Impilata
        className="mt-3"
        fette={[
          { nome: 'Scaduto', valore: scaduto, classe: 'bg-rosso' },
          { nome: 'In arrivo', valore: inArrivo, classe: tono === 'verde' ? 'bg-verde' : 'bg-ambra' }
        ]}
      />
      <div className="mt-2.5 flex items-center gap-4 text-[11.5px]">
        {scaduto > 0 && (
          <span><b className="text-rosso">{euro(scaduto)}</b> <span className="text-tenue">scaduto</span></span>
        )}
        <span><b className="text-soffuso">{euro(inArrivo)}</b> <span className="text-tenue">in arrivo</span></span>
        <button onClick={onApri} className="ml-auto flex items-center gap-1 text-tenue hover:text-testo">
          apri <Chevron dim={12} />
        </button>
      </div>
    </Pannello>
  );
}
