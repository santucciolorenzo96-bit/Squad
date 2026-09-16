import React, { useState } from 'react';
import { state } from '../state.js';
import { currentSport } from '../utils/sports/index.js';
import { refertoPartita, tabellaTabellino, quota } from '../utils/referto.js';
import { generaRefertoPdf } from '../utils/refertoPdf.js';
import { downloadCsv, safeName } from '../utils/csv.js';
import { sectorFullName } from '../utils/sectors.js';
import { canDeleteGame } from '../utils/permissions.js';
import { deleteGame } from '../api/games.js';
import { inCampione } from './campione.js';
import { Etichetta, Pannello, Pulsante, Vuoto, cx } from './ui.jsx';
import { Finestra, Conferma, useAvviso } from './moduli.jsx';

/* Il referto di una partita archiviata.
 *
 * Fino a ieri quello che lo scout raccoglieva durante la partita si poteva
 * leggere solo mentre la partita era aperta: chiusa, restava nel database e
 * spariva dalla vista. Qui torna, e torna intero — i set con le loro fasi, le
 * rotazioni, il tabellino — con due modi per portarlo fuori.
 *
 * L'ordine è quello in cui lo si legge: prima com'è finita, poi perché.
 */

/* Un numero grande con la sua etichetta sotto. Quattro in fila: si leggono
   come si legge un cruscotto, non come una frase. */
function Numero({ valore, etichetta, tono }) {
  return (
    <div>
      <div className={cx('cifra text-[22px] font-bold leading-none',
        tono === 'rosso' ? 'text-rosso' : 'text-testo')}>
        {valore}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase leading-tight tracking-etichetta text-tenue">
        {etichetta}
      </div>
    </div>
  );
}

function fmtData(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x) ? '' : x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function nomeCategoria() {
  const s = (state.sectors || []).find(x => x.id === state.activeSectorId);
  return s ? sectorFullName(s, state.sectors) : '';
}

export function Referto({ partita, onChiudi, onEliminata }) {
  const sport = currentSport();
  const [lavora, setLavora] = useState(null);
  const [daEliminare, setDaEliminare] = useState(false);
  const avvisa = useAvviso();

  /* La cancellazione sta QUI e non nell'elenco, di proposito.
   *
   * Una partita sbagliata — un tabellino aperto per prova, un 8-0 rimasto da
   * una partita mai giocata — sporca il record, la media punti e le
   * statistiche di ogni giocatrice. Va tolta. Ma è anche l'unica cosa in
   * questa schermata che non si può rifare: il tabellino non si ricostruisce
   * a memoria.
   *
   * Per questo il pulsante è dove la partita si vede per intero. Si guarda il
   * risultato, si guardano i set, si guarda chi ha giocato, e solo allora si
   * decide. Una piccola icona in un elenco si tocca per sbaglio. */
  const puoiEliminare = !!onEliminata
    && canDeleteGame(state.currentUser, state.activeSectorId, state.staffSectors);

  const conf = sport.scout;
  // «set» nella pallavolo, «periodo» nel basket: la parola la dice lo sport.
  const nomePeriodo = (conf.period.label || 'periodo').toLowerCase();
  // Le due fasi esistono solo dove ogni punto chiude uno scambio: altrove
  // sarebbero due colonne di trattini.
  const conFasi = !!conf.scambi;

  const r = refertoPartita(partita, sport);
  const t = tabellaTabellino(r, sport);
  const nostri = (state.teamProfile || {}).name || 'Noi';
  const vinta = (partita.teamScore || 0) > (partita.oppScore || 0);

  async function scaricaPdf() {
    setLavora('pdf');
    try {
      await generaRefertoPdf({
        team: state.teamProfile, game: partita, sport, sectorName: nomeCategoria()
      });
      avvisa('Referto scaricato');
    } catch (e) {
      console.error(e);
      avvisa((e && e.message) || 'Il PDF non si è generato.', 'errore');
    } finally {
      setLavora(null);
    }
  }

  function scaricaCsv() {
    downloadCsv(
      `referto_${safeName(nostri)}_${safeName(partita.oppName)}.csv`,
      t.intestazioni, t.righe
    );
    avvisa('Tabellino esportato');
  }

  return (
    <Finestra
      larga
      titolo={nostri + ' – ' + (partita.oppName || 'Avversari')}
      sotto={[fmtData(partita.date), partita.friendly ? 'amichevole' : 'campionato'].filter(Boolean).join(' · ')}
      onChiudi={onChiudi}
      azioni={
        <>
          <div className="flex flex-wrap gap-2">
            <Pulsante variante="primario" className="flex-1" disabled={!!lavora} onClick={scaricaPdf}>
              {lavora === 'pdf' ? 'Preparo…' : 'Scarica il referto in PDF'}
            </Pulsante>
            <Pulsante className="shrink-0" onClick={scaricaCsv}>CSV</Pulsante>
          </div>
          {puoiEliminare && (
            // Lontano dagli altri due e senza colore: si trova quando la si
            // cerca, e non si incontra quando si voleva il PDF.
            <button
              type="button"
              onClick={() => setDaEliminare(true)}
              className="mt-3 w-full rounded-lg py-2 text-[12.5px] font-semibold text-rosso transition-colors hover:bg-rosso/10"
            >
              Elimina questa partita dallo storico
            </button>
          )}
        </>
      }
    >
      {/* Il risultato, grande: è quello che si cerca per primo. */}
      <div className="mb-5 flex items-baseline gap-3">
        <span className={cx('cifra text-[40px] font-bold leading-none', vinta ? 'text-verde' : 'text-testo')}>
          {partita.teamScore ?? 0}<span className="mx-1.5 text-tenue">–</span>{partita.oppScore ?? 0}
        </span>
        <span className="text-[13px] text-tenue">
          {r.chiusi} {(r.chiusi === 1 ? nomePeriodo : nomePeriodo + (nomePeriodo.endsWith('o') ? 'i' : ''))}
        </span>
      </div>

      {/* ------------------------------------------------------------ i set */}
      {r.set.length > 0 && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">
            {nomePeriodo === 'set' ? 'I set' : 'I ' + nomePeriodo + 'i'}
          </Etichetta>
          <Pannello className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-bordo/10">
                    <th className="etichetta px-4 py-3">{conf.period.short}</th>
                    <th className="etichetta px-4 py-3">Punteggio</th>
                    {conFasi && <th className="etichetta px-4 py-3 text-right">Cambio palla</th>}
                    {conFasi && <th className="etichetta px-4 py-3 text-right">Break</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.set.map(s => (
                    <tr key={s.n} className="border-b border-bordo/6 last:border-b-0">
                      <td className="px-4 py-2.5 text-[13px] text-tenue">{s.n}</td>
                      <td className={cx('cifra px-4 py-2.5 text-[14px] font-bold',
                        s.us > s.them ? 'text-verde' : 'text-soffuso')}>
                        {s.us}–{s.them}
                      </td>
                      {conFasi && (
                        <td className="cifra px-4 py-2.5 text-right text-[13px]">
                          {quota(s.so) == null ? <span className="text-tenue">—</span> : (
                            <>{quota(s.so)}%<span className="ml-1.5 text-[12px] text-tenue">{s.so.v}/{s.so.t}</span></>
                          )}
                        </td>
                      )}
                      {conFasi && (
                        <td className="cifra px-4 py-2.5 text-right text-[13px]">
                          {quota(s.bp) == null ? <span className="text-tenue">—</span> : (
                            <>{quota(s.bp)}%<span className="ml-1.5 text-[12px] text-tenue">{s.bp.v}/{s.bp.t}</span></>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Pannello>

          {(r.fasi.so.t > 0 || r.fasi.bp.t > 0) && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
              In tutta la partita: cambio palla <b className="text-soffuso">{quota(r.fasi.so) ?? '—'}%</b>{' '}
              ({r.fasi.so.v} su {r.fasi.so.t}), break <b className="text-soffuso">{quota(r.fasi.bp) ?? '—'}%</b>{' '}
              ({r.fasi.bp.v} su {r.fasi.bp.t}).
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- le rotazioni */}
      {r.rotazioni.length > 0 && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">Le rotazioni</Etichetta>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {r.rotazioni.map(x => (
              <Pannello key={x.n} className="px-3 py-2.5 text-center">
                <div className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">R{x.n}</div>
                <div className={cx('cifra mt-1 text-[18px] font-bold leading-none',
                  x.saldo > 0 ? 'text-verde' : x.saldo < 0 ? 'text-rosso' : 'text-soffuso')}>
                  {x.saldo > 0 ? '+' : ''}{x.saldo}
                </div>
                <div className="cifra mt-1 text-[11.5px] text-tenue">{x.f}–{x.s}</div>
              </Pannello>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Punti fatti e subiti in ciascuna rotazione. È da qui che si decide da quale far
            partire il sestetto la prossima volta.
          </p>
        </div>
      )}

      {/* -------------------------------------------- come abbiamo attaccato */}
      {conf.possessi && r.attacco && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">Come abbiamo attaccato</Etichetta>
          <Pannello className="px-4 py-3.5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Numero
                valore={r.attacco.ppp.toFixed(2).replace('.', ',')}
                etichetta="Punti per possesso"
              />
              <Numero valore={r.attacco.possessi} etichetta="Possessi giocati" />
              <Numero
                valore={r.attacco.perse == null ? '—' : r.attacco.perse + '%'}
                etichetta="Possessi persi"
                tono={r.attacco.perse != null && r.attacco.perse > 20 ? 'rosso' : null}
              />
              <Numero
                valore={r.attacco.liberi == null ? '—' : r.attacco.liberi + '%'}
                etichetta="Liberi per 100 tiri"
              />
            </div>
          </Pannello>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Un possesso finisce con un tiro, con una palla persa o in lunetta. È l’unità che
            rende confrontabili due partite giocate a ritmi diversi: sessantotto punti in
            cinquanta possessi sono un’altra cosa da sessantotto in settanta.
          </p>
        </div>
      )}

      {/* ----------------------------------------------------- i quintetti */}
      {r.quintetti.length > 0 && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">I quintetti</Etichetta>
          <div className="space-y-2">
            {r.quintetti.map(q => (
              <Pannello key={q.chiave} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cx('cifra w-11 shrink-0 text-center text-[17px] font-bold leading-none',
                  q.saldo > 0 ? 'text-verde' : q.saldo < 0 ? 'text-rosso' : 'text-soffuso')}>
                  {q.saldo > 0 ? '+' : ''}{q.saldo}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-soffuso">
                  {q.nomi.join(' · ')}
                </span>
                <span className="cifra shrink-0 text-[12px] text-tenue">{q.f}–{q.s}</span>
              </Pannello>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Punti fatti e subiti dalla squadra con quei cinque in campo. È la riga su cui si
            decide chi entra in un finale punto a punto.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------ il tabellino */}
      <Etichetta className="mb-2.5">Il tabellino</Etichetta>
      {t.righe.length === 0 ? (
        <Vuoto>Questa partita non ha un tabellino: il risultato è stato scritto a mano.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-bordo/10">
                  {t.intestazioni.map((h, i) => (
                    <th key={h + i} className={cx('etichetta px-3 py-3', i > 1 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.righe.map((riga, i) => (
                  <tr key={i} className="border-b border-bordo/6 last:border-b-0">
                    {riga.map((cella, j) => (
                      <td
                        key={j}
                        className={cx('px-3 py-2.5 text-[13px]',
                          j === 0 && 'text-tenue',
                          j === 1 && 'font-semibold',
                          j > 1 && 'cifra text-right text-soffuso')}
                      >
                        {cella}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* La riga della squadra: in fondo, con un tratto sopra, come su
                  qualunque tabellino di carta. E' da li' che si legge com'e'
                  andata la partita, senza sommare a mente dodici righe. */}
              {t.totale && (
                <tfoot>
                  <tr className="border-t border-bordo/20">
                    {t.totale.map((cella, j) => (
                      <td
                        key={j}
                        className={cx('px-3 py-2.5 text-[13px] font-bold',
                          j > 1 && 'cifra text-right')}
                      >
                        {j === 0 ? '' : cella}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Pannello>
      )}

      {sport.seasonLegend && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-tenue">{sport.seasonLegend}</p>
      )}

      {daEliminare && (
        <Conferma
          titolo="Eliminare questa partita?"
          testo={
            `${nostri} – ${partita.oppName || 'Avversari'} ${partita.teamScore ?? 0}–${partita.oppScore ?? 0}`
            + ' sparisce dallo storico, e con lei il tabellino di tutti i giocatori.'
            + ' Record, media punti e statistiche si ricalcolano senza. Non si recupera.'
          }
          etichetta="Elimina"
          onChiudi={() => setDaEliminare(false)}
          onConferma={async () => {
            if (inCampione()) {
              throw new Error('Nell’anteprima con dati di esempio non si cancella niente.');
            }
            await deleteGame(partita.id);
            onEliminata(partita);
          }}
        />
      )}
    </Finestra>
  );
}
