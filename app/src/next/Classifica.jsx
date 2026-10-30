import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { computeRecord, computeStreak } from '../utils/stats.js';
import { fetchStandings, upsertStanding, removeStanding } from '../api/standings.js';
import { fetchLeagueMatches, saveLeagueMatch, removeLeagueMatch } from '../api/leagueMatches.js';
import { updateCalendarMatch } from '../api/calendar.js';
import { computeStandings } from '../utils/standingsCalc.js';
import {
  soloRegolare, siCalcola, nostraPartita, rigaDiCalendario,
  perGiornata, giornataInCorso
} from '../utils/campionato.js';
import { currentSport } from '../utils/sports/index.js';
import { canEditHome, managesSector, isAdmin } from '../utils/permissions.js';
import { fetchDeletedGames, ripristinaTabellino } from '../api/games.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Amichevole, cx } from './ui.jsx';
import {
  Interruttore, Modulo, Conferma, Campo, Testo, Data, Scelta, Spunta, useAvviso
} from './moduli.jsx';
import { IconaSezione, Chevron } from './icone.jsx';
import { Referto } from './Referto.jsx';

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

/* LA TABELLA, DA QUALUNQUE DELLE DUE PARTI ARRIVI.
 *
 * Le righe gliele passa chi la disegna: calcolate dai risultati quando ce ne
 * sono, digitate a mano quando non ce ne sono. Le due forme combaciano —
 * `computeStandings` scrive gli extra in `stats`, come la tabella digitata —
 * quindi qui non c'e` nessun ramo: cambia la provenienza, non il disegno.
 *
 * Quello che cambia e` cosa si puo` TOCCARE. Una riga calcolata non si
 * modifica: si modifica il risultato da cui viene, altrimenti la correzione
 * sparirebbe al prossimo conto senza dire niente.
 */
function Tabellone({ righe: dafuori, calcolata, puoiModificare, onModifica, onAggiungi }) {
  const noi = ((state.teamProfile || {}).name || '').trim().toLowerCase();
  const { st, fatti, subiti } = vociExtra();

  // A parita' di punti conta la differenza fra segnati e subiti: e' il criterio
  // che usano quasi tutti i campionati, e senza di quello due squadre appaiate
  // si ordinerebbero a caso a ogni ricaricamento.
  const righe = [...(dafuori || state.standings)].sort((a, b) =>
    (b.points - a.points)
    || (b.wins - a.wins)
    || ((valoreExtra(b, fatti) - valoreExtra(b, subiti)) - (valoreExtra(a, fatti) - valoreExtra(a, subiti)))
  );

  if (righe.length === 0) {
    return (
      <Vuoto>
        Nessuna classifica per questa categoria.
        {puoiModificare && ' Il modo che si aggiorna da solo e` inserire i RISULTATI delle'
          + ' partite del girone, da «Risultati»: la classifica viene da se`, con i punti'
          + ' dello sport. Altrimenti si possono scrivere le righe a mano, ma vanno'
          + ' riscritte ogni domenica.'}
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
          <span className="text-[12.5px] text-tenue">
            Le medie si calcolano da {fatti ? fatti.label.toLowerCase() : 'segnati'} e{' '}
            {subiti ? subiti.label.toLowerCase() : 'subiti'} totali: si inseriscono modificando la riga.
          </span>
          <Pulsante className="py-1.5 text-[12.5px]" onClick={onAggiungi}>+ Squadra</Pulsante>
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
          className="text-[13px] font-semibold text-rosso transition-opacity hover:opacity-75"
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

      <p className="!mt-2 text-[12.5px] leading-relaxed text-tenue">
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

/* LE PARTITE ELIMINATE.
 *
 * Dalla migrazione 061 eliminare un tabellino non cancella la riga: scrive
 * quando e chi. Quella scelta vale qualcosa solo se esiste un posto da cui
 * rimetterlo, e il posto è questo.
 *
 * Sta IN FONDO allo storico e chiuso, perché non è una cosa che si guarda:
 * è una cosa che si cerca, una volta, quando una partita non si trova più.
 * Lo vede solo chi amministra, come il pulsante che le elimina.
 *
 * Il nome di chi ha eliminato è metà del motivo per cui questo esiste: la
 * domanda da cui tutto è partito — «dov'è finita la partita?» — non aveva una
 * risposta, e «eliminata» senza un nome accanto non sarebbe una risposta
 * migliore.
 */
function Cestino({ onCambiato }) {
  const [righe, setRighe] = useState(null);     // null = non ancora chiesto
  const [aperto, setAperto] = useState(false);
  const [lavora, setLavora] = useState('');
  const avvisa = useAvviso();

  // Gli hook stanno sopra, sempre: la loro quantità non può dipendere da chi
  // sta guardando.
  if (!isAdmin(state.currentUser) || inCampione()) return null;

  async function apri() {
    setAperto(true);
    if (righe !== null) return;
    try {
      setRighe(await fetchDeletedGames(state.activeSectorId, state.activeSeasonId));
    } catch (e) {
      console.error(e);
      setRighe([]);
      avvisa((e && e.message) || 'Non ho potuto leggere le partite eliminate');
    }
  }

  async function rimetti(g) {
    setLavora(g.id);
    try {
      await ripristinaTabellino(g.id);
      /* E ANCHE IN MEMORIA, come per l'eliminazione: `state.history` è quello
       * caricato all'apertura della categoria, e senza rimetterci la partita
       * bisognerebbe ricaricare l'app per vederla tornare — che è proprio il
       * dubbio che si sta cercando di togliere. In ordine di data, perché lo
       * storico è ordinato e la riga non deve comparire in fondo. */
      state.history = [...state.history, g]
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      setRighe(v => (v || []).filter(x => x.id !== g.id));
      onCambiato('Partita rimessa nello storico');
    } catch (e) {
      console.error(e);
      avvisa((e && e.message) || 'Non ho potuto rimettere la partita');
    } finally {
      setLavora('');
    }
  }

  if (!aperto) {
    return (
      <button
        onClick={apri}
        className="w-full rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
      >
        Partite eliminate
      </button>
    );
  }

  return (
    <Pannello className="pad-pannello-stretto">
      <div className="flex items-center justify-between gap-2">
        <Etichetta>Partite eliminate</Etichetta>
        <button
          onClick={() => setAperto(false)}
          className="text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
        >
          Chiudi
        </button>
      </div>

      {righe === null && <p className="mt-3 text-[12.5px] text-tenue">Sto guardando…</p>}

      {righe !== null && righe.length === 0 && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-tenue">
          Nessuna partita eliminata in questa categoria. Un tabellino eliminato finisce qui
          con la data e il nome di chi l’ha eliminato, e da qui si può rimettere.
        </p>
      )}

      {(righe || []).map(g => (
        <div key={g.id} className="mt-2.5 flex items-center gap-3 rounded-lg bg-pannello/8 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {g.oppName || 'Avversari'} · {g.teamScore}–{g.oppScore}
              {g.friendly ? ' · amichevole' : ''}
            </div>
            <div className="text-[12.5px] text-tenue">
              {g.date && fmtData(g.date) + ' · '}
              eliminata {g.eliminataAlle ? fmtData(g.eliminataAlle) : ''}
              {g.eliminataDa ? ' da ' + g.eliminataDa : ''}
            </div>
          </div>
          <Pulsante
            className="shrink-0 py-1.5 text-[12.5px]"
            disabled={lavora === g.id}
            onClick={() => rimetti(g)}
          >
            {lavora === g.id ? 'Attendi…' : 'Rimetti'}
          </Pulsante>
        </div>
      ))}
    </Pannello>
  );
}

/* ----------------------------------------------------------------- lo storico */
function Storico({ onCambiato }) {
  const [referto, setReferto] = useState(null);
  const partite = [...state.history].reverse();   // la più recente per prima
  if (partite.length === 0) {
    /* Il cestino c'è anche a storico vuoto, e proprio lì serve: uno storico
       vuoto è esattamente il momento in cui si cerca una partita che non si
       trova più. */
    return (
      <div className="space-y-2.5">
        <Vuoto>Nessuna partita giocata. Lo storico si riempie quando i tabellini vengono chiusi.</Vuoto>
        <Cestino onCambiato={onCambiato} />
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {partite.map((g, i) => {
        const vinta = g.teamScore > g.oppScore;
        const pari = g.teamScore === g.oppScore;
        return (
          // Quello che lo scout ha raccolto durante la partita finora si
          // poteva leggere solo mentre la partita era aperta. Adesso la riga
          // si apre, e dentro c'e' tutto: set, fasi, rotazioni, tabellino.
          <Pannello
            key={i}
            onClick={() => setReferto(g)}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-pannello/8 sm:px-5"
          >
            {/* La lettera dell'esito prima di tutto: scorrendo l'elenco si
                legge l'andamento senza leggere i punteggi. */}
            <span className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
              pari ? 'bg-pannello/14 text-soffuso' : vinta ? 'bg-verde/16 text-verde' : 'bg-rosso/14 text-rosso'
            )}>
              {pari ? 'N' : vinta ? 'V' : 'S'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold">{g.oppName || 'Avversari'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-tenue">
                {g.date && <span>{fmtData(g.date)}</span>}
                {g.friendly && <Amichevole />}
              </div>
            </div>
            <div className="shrink-0 text-[16px] font-bold">
              {g.teamScore}<span className="mx-1 text-tenue">–</span>{g.oppScore}
            </div>
            <Chevron dim={16} className="shrink-0 text-tenue" />
          </Pannello>
        );
      })}

      {referto && (
        <Referto
          partita={referto}
          onChiudi={() => setReferto(null)}
          onEliminata={(g) => {
            // Via dallo storico in memoria: senza, la riga resterebbe finché
            // non si ricarica, e il record continuerebbe a contarla.
            state.history = state.history.filter(x => x !== g);
            setReferto(null);
            onCambiato('Partita eliminata');
          }}
        />
      )}

      <Cestino onCambiato={onCambiato} />
    </div>
  );
}

/* ------------------------------------------------------------- i risultati */
/* I RISULTATI DEL GIRONE, GIORNATA PER GIORNATA.
 *
 * E` la schermata che mancava, e senza la quale la classifica non si poteva
 * aggiornare: il calcolo c'era, i risultati non si potevano inserire da
 * nessuna parte.
 *
 * Si inseriscono TUTTE le partite, non solo le nostre: una classifica si fa
 * coi risultati di tutti. La nostra, quando arriva, aggiorna anche la riga di
 * calendario — perche` due schermate che si contraddicono sullo stesso evento
 * sono peggio di una sola incompleta.
 */
function Risultati({ partite, puoiModificare, onNuovo, onApri }) {
  const gruppi = perGiornata(partite);
  const noi = (state.teamProfile || {}).name;

  return (
    <div className="space-y-4">
      {puoiModificare && (
        <Pulsante variante="primario" className="w-full" onClick={onNuovo}>
          + Risultato
        </Pulsante>
      )}

      {gruppi.length === 0 ? (
        <Vuoto>
          Nessun risultato inserito.
          {puoiModificare && ' Si inseriscono tutte le partite del girone, non solo le nostre:'
            + ' una classifica si fa coi risultati di tutti. La nostra, quando la inserisci,'
            + ' aggiorna anche il calendario.'}
        </Vuoto>
      ) : gruppi.map(gr => (
        <div key={gr.giornata == null ? 'senza' : gr.giornata}>
          <Etichetta className="mb-2.5">
            {gr.giornata == null ? 'Senza giornata' : gr.giornata + 'ª giornata'}
          </Etichetta>
          <Pannello className="overflow-hidden">
            {gr.partite.map((m, i) => {
              const nostra = nostraPartita(m, noi);
              const daGiocare = m.home_score == null || m.away_score == null;
              return (
                <div
                  key={m.id || i}
                  onClick={puoiModificare ? () => onApri(m) : undefined}
                  className={cx(
                    'flex items-center gap-3 px-4 py-3 text-[13.5px] sm:px-5',
                    i > 0 && 'border-t border-bordo/6',
                    puoiModificare && 'cursor-pointer transition-colors hover:bg-pannello/8',
                    nostra && 'bg-blu/6'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-right">{m.home_team}</span>
                  <span className={cx(
                    'cifra shrink-0 rounded-lg px-2.5 py-1 text-[14px] font-bold',
                    daGiocare ? 'bg-pannello/10 text-tenue' : 'bg-pannello/14'
                  )}>
                    {daGiocare ? '–' : m.home_score + ' - ' + m.away_score}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.away_team}</span>
                </div>
              );
            })}
          </Pannello>
        </div>
      ))}

      {partite.length > 0 && (
        <p className="text-[12.5px] leading-relaxed text-tenue">
          Le nostre partite hanno il fondo azzurro. Un trattino al posto del punteggio vuol dire
          che la partita e` in calendario ma non ancora giocata: la classifica la ignora.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------- modulo risultato */
function ModuloRisultato({ partita, partite, onChiudi, onTogli, onFatto }) {
  const sport = currentSport();
  const [giornata, setGiornata] = useState(
    partita && partita.giornata != null ? String(partita.giornata)
      : String(giornataInCorso(partite))
  );
  const [data, setData] = useState(partita ? (partita.date || '') : '');
  const [fase, setFase] = useState(partita ? (partita.phase || 'regular') : 'regular');
  const [casa, setCasa] = useState(partita ? partita.home_team : '');
  const [fuori, setFuori] = useState(partita ? partita.away_team : '');
  const [puntiCasa, setPuntiCasa] = useState(
    partita && partita.home_score != null ? String(partita.home_score) : ''
  );
  const [puntiFuori, setPuntiFuori] = useState(
    partita && partita.away_score != null ? String(partita.away_score) : ''
  );

  const nostroNome = (state.teamProfile || {}).name || '';

  return (
    <Modulo
      titolo={partita ? 'Risultato' : 'Nuovo risultato'}
      sotto="Una partita del girone, anche fra due squadre che non siamo noi."
      etichettaInvia="Salva"
      onChiudi={onChiudi}
      azioniExtra={partita
        ? (
          <button
            onClick={onTogli}
            className="text-[12.5px] font-semibold text-rosso transition-colors hover:brightness-110"
          >
            Togli
          </button>
        )
        : null}
      onInvia={async () => {
        const c = casa.trim();
        const f = fuori.trim();
        if (!c || !f) return 'Scrivi il nome di entrambe le squadre.';
        if (c.toLowerCase() === f.toLowerCase()) return 'Le due squadre devono essere diverse.';
        const pc = puntiCasa.trim() === '' ? null : parseInt(puntiCasa, 10);
        const pf = puntiFuori.trim() === '' ? null : parseInt(puntiFuori, 10);
        /* O tutti e due o nessuno: con un punteggio solo non si sa chi ha
         * vinto, e una riga mezza riempita in classifica non ci va. Meglio
         * dirlo adesso che farla sparire dal conto senza spiegazioni. */
        if ((pc == null) !== (pf == null)) {
          return 'Scrivi tutti e due i punteggi, oppure nessuno dei due.';
        }

        const salvata = await saveLeagueMatch(state.teamProfile.id, state.activeSectorId, {
          id: partita ? partita.id : null,
          giornata: giornata.trim() ? parseInt(giornata, 10) : null,
          date: data || null,
          phase: fase,
          home_team: c,
          away_team: f,
          home_score: pc,
          away_score: pf
        }, state.activeSeasonId);

        /* SE IL RISULTATO E` NOSTRO, il calendario si allinea: quella partita
         * smette di risultare «da giocare». Se questo non riesce il risultato
         * e` comunque salvato — si dice e si va avanti, perche` un calendario
         * non allineato non vale la perdita dell'inserimento. */
        const riga = rigaDiCalendario(state.calendar, salvata, nostroNome);
        if (riga) {
          const nostra = nostraPartita(salvata, nostroNome);
          try {
            const agg = await updateCalendarMatch(riga.id, {
              played: true, team_score: nostra.nostriPunti, opp_score: nostra.loroPunti
            });
            Object.assign(riga, agg);
            onFatto('Risultato salvato, e il calendario è aggiornato');
            return undefined;
          } catch (e) {
            console.error(e);
            onFatto('Risultato salvato, ma il calendario non si è aggiornato');
            return undefined;
          }
        }
        onFatto('Risultato salvato');
        return undefined;
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Giornata">
          <Testo
            inputMode="numeric"
            value={giornata}
            onChange={e => setGiornata(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          />
        </Campo>
        <Campo etichetta="Data">
          <Data value={data} onChange={e => setData(e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="In casa">
        <Testo value={casa} onChange={e => setCasa(e.target.value)} autoFocus />
      </Campo>
      <Campo etichetta="In trasferta">
        <Testo value={fuori} onChange={e => setFuori(e.target.value)} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta={sport.match.scoreLabel + ' in casa'}>
          <Testo
            inputMode="numeric"
            value={puntiCasa}
            onChange={e => setPuntiCasa(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            className="text-center text-[20px] font-bold"
          />
        </Campo>
        <Campo etichetta={sport.match.scoreLabel + ' in trasferta'}>
          <Testo
            inputMode="numeric"
            value={puntiFuori}
            onChange={e => setPuntiFuori(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            className="text-center text-[20px] font-bold"
          />
        </Campo>
      </div>

      <Campo etichetta="Fase">
        <Scelta value={fase} onChange={e => setFase(e.target.value)}>
          <option value="regular">Stagione regolare</option>
          <option value="playoff">Playoff</option>
        </Scelta>
      </Campo>

      <p className="text-[12.5px] leading-relaxed text-tenue">
        Solo la stagione regolare fa classifica: i playoff sono un altro tabellone, e sommarli
        al girone darebbe una classifica che non esiste in nessun documento.
        {' '}Senza punteggi la partita resta in elenco come da giocare.
      </p>
    </Modulo>
  );
}

/* --------------------------------------------------------------------------- */
export function Classifica() {
  const sport = currentSport();
  const { st } = vociExtra();
  const [vista, setVista] = useState('classifica');
  const [modulo, setModulo] = useState(null);        // null | {} | riga
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  /* I RISULTATI DEL GIRONE.
   *
   * Non stanno nello `state` globale perche` non li guarda nessun'altra
   * schermata, e si caricano all'apertura della sezione: una tabella che puo`
   * non esistere ancora non deve impedire di consultare la classifica, quindi
   * un errore qui diventa un elenco vuoto e non una schermata rotta. */
  const [risultati, setRisultati] = useState([]);
  const [moduloRisultato, setModuloRisultato] = useState(null);
  const [risultatoDaTogliere, setRisultatoDaTogliere] = useState(null);

  async function ricaricaRisultati() {
    if (inCampione()) { setRisultati([]); return; }
    try {
      setRisultati(await fetchLeagueMatches(state.activeSectorId, state.activeSeasonId) || []);
    } catch (e) {
      console.error(e);
      setRisultati([]);
    }
  }

  useEffect(() => { ricaricaRisultati(); }, [state.activeSectorId, state.activeSeasonId]);

  /* QUALE CLASSIFICA VALE non e` una preferenza da chiedere: lo dicono i dati.
   * Appena esiste un risultato giocato si calcola; finche` non ce n'e` nessuno
   * resta quella digitata, cosi` chi aveva gia` scritto la sua tabella non la
   * perde e chi inserisce il primo risultato non deve anche ricordarsi di
   * cambiare un interruttore.
   *
   * Le righe digitate restano in gioco anche quando si calcola: servono da
   * elenco delle squadre del girone, cosi` chi non ha ancora giocato compare
   * a zero invece di non esserci. */
  const calcolata = siCalcola(risultati);
  const righeClassifica = calcolata
    ? computeStandings(
      soloRegolare(risultati),
      sport,
      (state.teamProfile || {}).name,
      (state.standings || []).map(r => r.team_name)
    )
    : null;

  const puoiModificare = canEditHome(state.currentUser) && managesSector(state.currentUser, state.activeSectorId, state.staffSectors);
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
            {
              id: 'classifica',
              testo: 'Classifica',
              conteggio: (righeClassifica || state.standings).length || null
            },
            { id: 'risultati', testo: 'Risultati', conteggio: risultati.length || null },
            { id: 'storico', testo: 'Storico', conteggio: state.history.length || null }
          ]}
        />
      </div>

      {vista === 'classifica' ? (
        <>
          <Tabellone
            righe={righeClassifica}
            calcolata={calcolata}
            puoiModificare={puoiModificare}
            onModifica={(r) => setModulo(r)}
            onAggiungi={() => setModulo({})}
          />
          {/* DA DOVE VIENE QUESTA TABELLA.
              Senza dirlo, chi corregge una riga a mano e la vede tornare come
              prima crede che l'app non salvi. */}
          <p className="text-[12.5px] leading-relaxed text-tenue">
            {calcolata
              ? 'Calcolata dai risultati del girone: ' + st.pointsHint
                + ' Per correggerla si corregge il risultato, da «Risultati».'
              : 'Scritta a mano. Inserendo i risultati delle partite da «Risultati», la classifica'
                + ' si calcola da sola e non va più riscritta ogni domenica.'}
          </p>
        </>
      ) : vista === 'risultati' ? (
        <Risultati
          partite={risultati}
          puoiModificare={puoiModificare}
          onNuovo={() => setModuloRisultato({})}
          onApri={(m) => setModuloRisultato(m)}
        />
      ) : <Storico onCambiato={(msg) => { ridisegna(n => n + 1); avvisa(msg); }} />}

      {moduloRisultato && (
        <ModuloRisultato
          partita={moduloRisultato.id ? moduloRisultato : null}
          partite={risultati}
          onChiudi={() => setModuloRisultato(null)}
          onTogli={() => { const m = moduloRisultato; setModuloRisultato(null); setRisultatoDaTogliere(m); }}
          onFatto={async (msg) => {
            setModuloRisultato(null);
            await ricaricaRisultati();
            ridisegna(n => n + 1);
            avvisa(msg);
          }}
        />
      )}

      {risultatoDaTogliere && (
        <Conferma
          titolo="Togliere questo risultato?"
          testo={`${risultatoDaTogliere.home_team} – ${risultatoDaTogliere.away_team}`
            + ' esce dal girone, e la classifica si ricalcola senza questa partita.'}
          etichetta="Togli"
          onChiudi={() => setRisultatoDaTogliere(null)}
          onConferma={async () => {
            await removeLeagueMatch(risultatoDaTogliere.id);
            setRisultatoDaTogliere(null);
            await ricaricaRisultati();
            ridisegna(n => n + 1);
            avvisa('Risultato tolto');
          }}
        />
      )}

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
