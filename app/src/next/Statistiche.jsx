import React, { useState } from 'react';
import { state } from '../state.js';
import { computeSeasonStats } from '../utils/stats.js';
import { currentSport } from '../utils/sports/index.js';
import { Pannello, Etichetta, Titolo, Vuoto, cx } from './ui.jsx';

/* Le statistiche di stagione.
 *
 * Una tabella di numeri va ordinata da chi la guarda, non da chi la scrive:
 * l'intestazione di ogni colonna è un pulsante. Si parte dalla prima colonna
 * del descrittore dello sport — i punti nel basket — perché è quella che si
 * guarda per prima in ogni sport che li conta.
 *
 * Su telefono la tabella scorre di lato, ed è l'unico posto dell'app dove è
 * giusto: qui le colonne sono numeri omogenei, e scorrere lungo una riga è
 * proprio come si legge un tabellino di carta. È diverso dall'anagrafica, dove
 * a destra si nascondeva se un atleta può giocare o no.
 */

export function Statistiche() {
  const sport = currentSport();
  const colonne = sport.seasonColumns;
  const [ordine, setOrdine] = useState(colonne[0] ? colonne[0].key : 'games');

  const righe = computeSeasonStats(state.history, sport)
    .slice()
    .sort((a, b) => (b[ordine] || 0) - (a[ordine] || 0));

  if (state.history.length === 0) {
    return (
      <div className="sezioni">
        <Titolo sopra="Categoria">Statistiche</Titolo>
        <Vuoto>
          Nessuna partita giocata in questa stagione. Le statistiche si riempiono da sole
          man mano che i tabellini vengono chiusi.
        </Vuoto>
      </div>
    );
  }

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={<span className="shrink-0 text-[12.5px] text-tenue">{state.history.length} partite</span>}
      >
        Statistiche
      </Titolo>

      <Pannello className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-bordo/10">
                <th className="etichetta sticky left-0 z-10 vetro px-4 py-3.5">Giocatore</th>
                <th className="etichetta px-3 py-3.5 text-right">PG</th>
                {colonne.map(c => (
                  <th key={c.key} className="px-3 py-3.5 text-right">
                    <button
                      onClick={() => setOrdine(c.key)}
                      title={c.label}
                      className={cx(
                        'etichetta transition-colors',
                        ordine === c.key ? '!text-blu' : 'hover:!text-testo'
                      )}
                    >
                      {c.short || c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.map(r => (
                <tr key={(r.id || r.name)} className="border-b border-bordo/6 last:border-b-0 hover:bg-pannello/8">
                  <td className="sticky left-0 z-10 vetro px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-right text-[13px] font-medium text-tenue">
                        {r.number}
                      </span>
                      <span className="truncate text-[13.5px] font-semibold">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-[13px] text-tenue">{r.games}</td>
                  {colonne.map(c => (
                    <td
                      key={c.key}
                      className={cx('px-3 py-3 text-right text-[13.5px]',
                        ordine === c.key ? 'font-bold text-testo' : 'text-soffuso')}
                    >
                      {r[c.key] || 0}
                      {/* La media a partita accanto al totale, piccola: è il
                          numero che si confronta fra giocatori che hanno
                          giocato un numero diverso di partite. */}
                      {c.avg && r.games > 0 && (
                        <span className="ml-1.5 text-[11px] text-tenue">
                          {(r[c.key] / r.games).toFixed(1)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pannello>

      {sport.seasonLegend && (
        <p className="text-[11.5px] leading-relaxed text-tenue">{sport.seasonLegend}</p>
      )}
    </div>
  );
}
