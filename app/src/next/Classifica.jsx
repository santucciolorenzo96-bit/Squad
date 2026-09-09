import React, { useState } from 'react';
import { state } from '../state.js';
import { computeRecord, computeStreak } from '../utils/stats.js';
import { Pannello, Etichetta, Titolo, Vuoto, Stato, cx } from './ui.jsx';
import { Interruttore } from './moduli.jsx';
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
function Tabellone() {
  const noi = ((state.teamProfile || {}).name || '').trim().toLowerCase();
  const righe = [...state.standings].sort((a, b) => (b.points - a.points) || (b.won - a.won));

  if (righe.length === 0) {
    return <Vuoto>Nessuna classifica caricata per questa categoria.</Vuoto>;
  }

  return (
    <Pannello className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-bordo/10">
              <th className="etichetta w-10 px-4 py-3.5">#</th>
              <th className="etichetta px-2 py-3.5">Squadra</th>
              <th className="etichetta px-3 py-3.5 text-right">G</th>
              <th className="etichetta px-3 py-3.5 text-right">V</th>
              <th className="etichetta px-3 py-3.5 text-right">P</th>
              <th className="etichetta px-4 py-3.5 text-right">Punti</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const nostra = (r.team_name || '').trim().toLowerCase() === noi;
              return (
                <tr
                  key={r.id || r.team_name}
                  className={cx(
                    'relative border-b border-bordo/6 last:border-b-0',
                    nostra ? 'bg-blu/10' : 'hover:bg-pannello/8'
                  )}
                >
                  <td className="relative px-4 py-3 text-[13px] text-tenue">
                    {nostra && <span className="absolute inset-y-0 left-0 w-1 bg-blu" />}
                    {i + 1}
                  </td>
                  <td className={cx('px-2 py-3 text-[13.5px]', nostra ? 'font-bold' : 'font-medium')}>
                    {r.team_name}
                  </td>
                  <td className="px-3 py-3 text-right text-[13px] text-soffuso">{r.played}</td>
                  <td className="px-3 py-3 text-right text-[13px] text-verde">{r.won}</td>
                  <td className="px-3 py-3 text-right text-[13px] text-tenue">{r.lost}</td>
                  <td className="px-4 py-3 text-right text-[15px] font-bold">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Pannello>
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

      {vista === 'classifica' ? <Tabellone /> : <Storico />}
    </div>
  );
}
