import React, { useState } from 'react';
import { state } from '../state.js';
import { computeRecord, computeStreak } from '../utils/stats.js';
import { fetchStandings, upsertStanding, removeStanding } from '../api/standings.js';
import { currentSport } from '../utils/sports/index.js';
import { canEditHome } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, cx } from './ui.jsx';
import { Interruttore, Modulo, Conferma, Campo, Testo, Spunta, useAvviso } from './moduli.jsx';
import { IconaSezione } from './icone.jsx';

/* Classifica e storico.
 *
 * Due viste della stessa domanda: come stiamo andando. La classifica dice dove
 * siamo rispetto alle altre, lo storico come ci siamo arrivati.
 *
 * La riga della propria squadra è evidenziata, e non con un colore acceso: con
 * un fondo appena più chiaro e il bordo di sinistra blu. In un elenco di dieci
 * squadre serve trovarsi in un colpo d'occhio, non essere abbagliati.
 */

function fmtData(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------- la classifica */
// Le colonne dei punti fatti e subiti non sono "basket": ogni sport dichiara le
// sue due voci con lo stesso ruolo (segnati / subiti), e qui si legge quella
// dichiarazione. Nel calcio diventano gol, nella pallavolo set.
function vociExtra() {
  const st = (currentSport().standings) || {};
  const extras = st.extras || [];
  return {
    st,
    fatti: extras.find(e => e.role === 'scored') || null,
    subiti: extras.find(e => e.role === 'conceded') || null
  };
}

function media(totale, giocate) {
  if (!giocate) return null;
  return (totale / giocate).toFixed(1).replace('.', ',');
}

function valoreExtra(riga, voce) {
  if (!voce) return 0;
  const s = riga.stats || {};
  const v = s[voce.key];
  return typeof v === 'number' ? v : (parseInt(v, 10) || 0);
}

function Tabellone({ puoiModificare, onModifica, onAggiungi }) {
  const noi = ((state.teamProfile || {}).name || '').trim().toLowerCase();
  const { st, fatti, subiti } = vociExtra();

  // A parita' di punti conta la differenza fra segnati e subiti: e' il criterio
  // che usano quasi tutti i campionati, e senza di quello due squadre appaiate
  // si ordinerebbero a caso a ogni ricaricamento.
  const righe = [...state.standings].sort((a, b) =>
    (b.points - a.points)
    || (b.wins - a.wins)
    || ((valoreExtra(b, fatti) - valoreExtra(b, subiti)) - (valoreExtra(a, fatti) - valoreExtra(a, subiti)))
  );

  if (righe.length === 0) {
    return (
      <Vuoto>
        Nessuna classifica caricata per questa categoria.
        {puoiModificare && ' Aggiungi le squadre del girone: bastano nome, giocate e punti.'}
      </Vuoto>
    );
  }

  return (
    <Pannello className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-bordo/10">
              <th className="etichetta w-10 px-4 py-3.5">#</th>
              <th className="etichetta px-2 py-3.5">Squadra</th>
              <th className="etichetta px-3 py-3.5 text-right">G</th>
              <th className="etichetta px-3 py-3.5 text-right">{st.winLabel || 'V'}</th>
              {st.hasDraws && <th className="etichetta px-3 py-3.5 text-right">{st.drawLabel || 'N'}</th>}
              <th className="etichetta px-3 py-3.5 text-right">{st.lossLabel || 'P'}</th>
              {fatti && (
                <th className="etichetta px-3 py-3.5 text-right" title={'Media ' + fatti.label.toLowerCase() + ' a partita'}>
                  {fatti.short}/g
                </th>
              )}
              {subiti && (
                <th className="etichetta px-3 py-3.5 text-right" title={'Media ' + subiti.label.toLowerCase() + ' a partita'}>
                  {subiti.short}/g
                </th>
              )}
              <th className="etichetta px-4 py-3.5 text-right">Punti</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const nostra = (r.team_name || '').trim().toLowerCase() === noi;
              const mf = media(valoreExtra(r, fatti), r.played);
              const ms = media(valoreExtra(r, subiti), r.played);
              return (
                <tr
                  key={r.id || r.team_name}
                  onClick={puoiModificare ? () => onModifica(r) : undefined}
                  className={cx(
                    'relative border-b border-bordo/6 last:border-b-0',
                    nostra ? 'bg-blu/10' : 'hover:bg-pannello/8',
                    puoiModificare && 'cursor-pointer'
                  )}
                >
                  <td className="relative px-4 py-3 text-[13px] text-tenue">
                    {nostra && <span className="absolute inset-y-0 left-0 w-1 bg-blu" />}
                    {i + 1}
                  </td>
                  <td className={cx('px-2 py-3 text-[13.5px]', nostra ? 'font-bold' : 'font-medium')}>
                    {r.team_name}
                  </td>
                  <td className="cifra px-3 py-3 text-right text-[13px] text-soffuso">{r.played}</td>
                  <td className="cifra px-3 py-3 text-right text-[13px] text-verde">{r.wins}</td>
                  {st.hasDraws && (
                    <td className="cifra px-3 py-3 text-right text-[13px] text-soffuso">{r.draws || 0}</td>
                  )}
                  <td className="cifra px-3 py-3 text-right text-[13px] text-tenue">{r.losses}</td>
                  {fatti && (
                    <td className="cifra px-3 py-3 text-right text-[13px] text-soffuso">{mf || '—'}</td>
                  )}
                  {subiti && (
                    <td className="cifra px-3 py-3 text-right text-[13px] text-soffuso">{ms || '—'}</td>
                  )}
                  <td className="cifra px-4 py-3 text-right text-[15px] font-bold">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {puoiModificare && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordo/10 px-4 py-3">
          <span className="text-[11.5px] text-tenue">
            Le medie si calcolano da {fatti ? fatti.label.toLowerCase() : 'segnati'} e{' '}
            {subiti ? subiti.label.toLowerCase() : 'subiti'} totali: si inseriscono modificando la riga.
          </span>
          <Pulsante className="py-1.5 text-[11.5px]" onClick={onAggiungi}>+ Squadra</Pulsante>
        </div>
      )}
    </Pannello>
  );
}

/* --------------------------------------------------- inserimento a mano */
// La classifica non arriva da nessuna parte: la si copia da quella del
// campionato. I totali si scrivono come stanno sul foglio della federazione,
// le medie le fa l'app: chiedere una media a chi ha in mano dei totali vuol
// dire chiedergli una divisione.
function ModuloSquadra({ riga, onChiudi, onFatto, onRimuovi }) {
  const { st, fatti, subiti } = vociExtra();
  const nuova = !riga;
  const [nome, setNome] = useState(riga ? riga.team_name : ((state.teamProfile || {}).name || ''));
  const [giocate, setGiocate] = useState(riga ? String(riga.played) : '0');
  const [vinte, setVinte] = useState(riga ? String(riga.wins) : '0');
  const [pari, setPari] = useState(riga ? String(riga.draws || 0) : '0');
  const [perse, setPerse] = useState(riga ? String(riga.losses) : '0');
  const [punti, setPunti] = useState(riga ? String(riga.points) : '0');
  const [tf, setTf] = useState(riga ? String(valoreExtra(riga, fatti)) : '0');
  const [ts, setTs] = useState(riga ? String(valoreExtra(riga, subiti)) : '0');
  const [nostra, setNostra] = useState(riga ? !!riga.is_us : false);

  const n = (v) => parseInt(v, 10) || 0;

  return (
    <Modulo
      titolo={nuova ? 'Aggiungi una squadra' : riga.team_name}
      sotto={st.pointsHint}
      etichettaInvia={nuova ? 'Aggiungi' : 'Salva'}
      onChiudi={onChiudi}
      azioniExtra={!nuova && onRimuovi ? (
        <button
          type="button"
          onClick={onRimuovi}
          className="text-[12px] font-semibold text-rosso transition-opacity hover:opacity-75"
        >
          Rimuovi
        </button>
      ) : null}
      onInvia={async () => {
        if (!nome.trim()) return 'Scrivi il nome della squadra.';
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';
        const stats = { ...((riga && riga.stats) || {}) };
        if (fatti) stats[fatti.key] = n(tf);
        if (subiti) stats[subiti.key] = n(ts);
        const dati = {
          team_name: nome.trim(),
          played: n(giocate), wins: n(vinte), draws: st.hasDraws ? n(pari) : 0,
          losses: n(perse), points: n(punti), is_us: nostra, stats
        };
        await upsertStanding(
          state.teamProfile.id, state.activeSectorId,
          riga ? { id: riga.id, ...dati } : dati,
          state.activeSeasonId
        );
        state.standings = await fetchStandings(state.activeSectorId, state.activeSeasonId);
        onFatto(nuova ? 'Squadra aggiunta' : 'Classifica aggiornata');
      }}
    >
      <Campo etichetta="Nome della squadra">
        <Testo value={nome} onChange={e => setNome(e.target.value)} autoFocus={nuova} />
      </Campo>

      <div className={cx('grid gap-3', st.hasDraws ? 'grid-cols-4' : 'grid-cols-3')}>
        <Campo etichetta="Giocate"><Testo type="number" min="0" value={giocate} onChange={e => setGiocate(e.target.value)} /></Campo>
        <Campo etichetta={st.winLabel === 'V' ? 'Vinte' : (st.winLabel || 'Vinte')}>
          <Testo type="number" min="0" value={vinte} onChange={e => setVinte(e.target.value)} />
        </Campo>
        {st.hasDraws && (
          <Campo etichetta="Pareggi"><Testo type="number" min="0" value={pari} onChange={e => setPari(e.target.value)} /></Campo>
        )}
        <Campo etichetta="Perse"><Testo type="number" min="0" value={perse} onChange={e => setPerse(e.target.value)} /></Campo>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {fatti && (
          <Campo etichetta={fatti.label}>
            <Testo type="number" min="0" value={tf} onChange={e => setTf(e.target.value)} />
          </Campo>
        )}
        {subiti && (
          <Campo etichetta={subiti.label}>
            <Testo type="number" min="0" value={ts} onChange={e => setTs(e.target.value)} />
          </Campo>
        )}
        <Campo etichetta="Punti">
          <Testo type="number" min="0" value={punti} onChange={e => setPunti(e.target.value)} />
        </Campo>
      </div>

      <p className="!mt-2 text-[11.5px] leading-relaxed text-tenue">
        Totali di tutto il campionato, non della singola partita: la media a partita la calcola l’app.
      </p>

      <Spunta
        etichetta="È la nostra squadra"
        checked={nostra}
        onChange={e => setNostra(e.target.checked)}
      />
    </Modulo>
  );
}

/* ----------------------------------------------------------------- lo storico */
function Storico() {
  const partite = [...state.history].reverse();   // la più recente per prima
  if (partite.length === 0) {
    return <Vuoto>Nessuna partita giocata. Lo storico si riempie quando i tabellini vengono chiusi.</Vuoto>;
  }
  return (
    <div className="space-y-2.5">
      {partite.map((g, i) => {
        const vinta = g.teamScore > g.oppScore;
        const pari = g.teamScore === g.oppScore;
        return (
          <Pannello key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            {/* La lettera dell'esito prima di tutto: scorrendo l'elenco si
                legge l'andamento senza leggere i punteggi. */}
            <span className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
              pari ? 'bg-pannello/14 text-soffuso' : vinta ? 'bg-verde/16 text-verde' : 'bg-rosso/14 text-rosso'
            )}>
              {pari ? 'N' : vinta ? 'V' : 'S'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{g.oppName || 'Avversari'}</div>
              {g.date && <div className="text-[11.5px] text-tenue">{fmtData(g.date)}</div>}
            </div>
            <div className="shrink-0 text-[16px] font-bold">
              {g.teamScore}<span className="mx-1 text-tenue">–</span>{g.oppScore}
            </div>
          </Pannello>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
export function Classifica() {
  const [vista, setVista] = useState('classifica');
  const [modulo, setModulo] = useState(null);        // null | {} | riga
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditHome(state.currentUser);
  const record = computeRecord(state.history);
  const serie = computeStreak(state.history);

  return (
    <div className="sezioni">
      <Titolo sopra="Categoria">Classifica</Titolo>

      {state.history.length > 0 && (
        <Pannello className="pad-pannello-stretto">
          <div className="flex items-center gap-2.5">
            <IconaSezione id="classifica" dim={26} />
            <Etichetta>Come stiamo andando</Etichetta>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <div className="text-[26px] font-bold leading-none">{record.w}–{record.l}</div>
              <Etichetta className="mt-2">vinte–perse</Etichetta>
            </div>
            <div>
              <div className="text-[15px] font-semibold leading-none">{serie}</div>
              <Etichetta className="mt-2">andamento</Etichetta>
            </div>
          </div>
        </Pannello>
      )}

      <div className="flex items-center justify-between gap-3">
        <Interruttore
          valore={vista}
          onCambia={setVista}
          voci={[
            { id: 'classifica', testo: 'Classifica', conteggio: state.standings.length || null },
            { id: 'storico', testo: 'Storico', conteggio: state.history.length || null }
          ]}
        />
      </div>

      {vista === 'classifica' ? (
        <Tabellone
          puoiModificare={puoiModificare}
          onModifica={(r) => setModulo(r)}
          onAggiungi={() => setModulo({})}
        />
      ) : <Storico />}

      {modulo && (
        <ModuloSquadra
          riga={modulo.id ? modulo : null}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { setModulo(null); ridisegna(n => n + 1); avvisa(msg); }}
          onRimuovi={() => { const r = modulo; setModulo(null); setDaRimuovere(r); }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo={'Togliere ' + daRimuovere.team_name + '?'}
          testo="Sparisce dalla classifica di questa categoria. Le partite giocate contro di loro restano nello storico."
          etichetta="Togli"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            if (inCampione()) { avvisa('Nell’anteprima con dati di esempio non si cancella niente.'); return; }
            await removeStanding(daRimuovere.id);
            state.standings = state.standings.filter(x => x.id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Squadra tolta');
          }}
        />
      )}
    </div>
  );
}
