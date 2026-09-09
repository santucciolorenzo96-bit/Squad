import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { state } from '../state.js';
import { saveLiveGame, endGame } from '../api/games.js';
import { updateCalendarMatch } from '../api/calendar.js';
import { currentSport } from '../utils/sports/index.js';
import { Pannello, Etichetta, Pulsante, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso } from './moduli.jsx';
import { inCampione } from './campione.js';

/* Lo scout dal vivo.
 *
 * Due regole, e vengono dal campo, non dal disegno:
 *
 * 1. DUE TOCCHI PER OGNI EVENTO — giocatore, poi azione — e mai uno scorrimento
 *    in mezzo. I comandi si aprono ancorati in basso, sotto il pollice. Nel
 *    basket si segna un evento ogni pochi secondi: ogni gesto in più si paga
 *    per tutta la partita.
 *
 * 2. IL PUNTEGGIO AVVERSARIO SI SCRIVE A FINE PERIODO, non colpo su colpo.
 *    Inseguire i canestri altrui mentre si segue la propria squadra è la prima
 *    causa di tabellini sbagliati.
 *
 * Niente cronometro: nel basket si ferma troppo spesso perché valga la pena
 * inseguirlo, e i minuti contati male sono peggio dei minuti non contati.
 */

function calcolaPunteggi(g, sport) {
  const conf = sport.scout;
  const periodi = g.periodScores || [];
  if (conf.scoreDisplay === 'setsWon') {
    g.teamScore = periodi.filter(x => x && x.us > x.them).length;
    g.oppScore = periodi.filter(x => x && x.them > x.us).length;
    return;
  }
  g.teamScore = conf.ourScore === 'fromActions'
    ? g.players.reduce((n, p) => n + sport.score(p.stats || {}), 0)
    : periodi.reduce((n, x) => n + ((x && x.us) || 0), 0);
  g.oppScore = periodi.reduce((n, x) => n + ((x && x.them) || 0), 0);
}

export function Tracker({ onFinita }) {
  const sport = currentSport();
  const conf = sport.scout;
  const avvisa = useAvviso();

  const [, ridisegna] = useState(0);
  const [scelto, setScelto] = useState(null);      // id giocatore col pannello aperto
  const [lampo, setLampo] = useState(null);        // { id, testo } riscontro dell'ultima azione
  const [sostituzione, setSostituzione] = useState(null);
  const [chiudiPeriodo, setChiudiPeriodo] = useState(false);
  const [finePartita, setFinePartita] = useState(false);
  const salvataggioRotto = useRef(false);

  const g = state.liveGame;
  if (!g) return null;
  if (!g.periodScores) g.periodScores = [];
  calcolaPunteggi(g, sport);

  const aggiorna = () => ridisegna(n => n + 1);

  // Il salvataggio gira a ogni azione senza bloccare niente. Ma se fallisce va
  // detto: durante una partita si continuerebbe a segnare per un'ora credendo
  // che tutto stia andando in archivio. Si avvisa una volta sola, e si torna a
  // tacere appena riprende.
  function salva() {
    if (inCampione()) return;   // niente database dietro: non c'e' dove salvare
    saveLiveGame(g.id, g).then(() => {
      if (salvataggioRotto.current) {
        salvataggioRotto.current = false;
        avvisa('Salvataggio ripreso');
      }
    }).catch(e => {
      console.error(e);
      if (!salvataggioRotto.current) {
        salvataggioRotto.current = true;
        avvisa('Il salvataggio non riesce: continua pure, ma controlla la connessione.', 'errore');
      }
    });
  }

  function memorizza() {
    state.undoStack.push(JSON.stringify(g));
    if (state.undoStack.length > 60) state.undoStack.shift();
  }

  function annulla() {
    if (state.undoStack.length === 0) { avvisa('Niente da annullare'); return; }
    state.liveGame = JSON.parse(state.undoStack.pop());
    setScelto(null);
    aggiorna();
    salva();
  }

  function esegui(giocatore, azione) {
    memorizza();
    const s = giocatore.stats;
    Object.entries(azione.apply || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
    if (azione.nested) {
      Object.entries(azione.nested).forEach(([contenitore, chiave]) => {
        s[contenitore] = s[contenitore] || {};
        s[contenitore][chiave] = (s[contenitore][chiave] || 0) + 1;
      });
    }
    if (azione.teamFoul && conf.teamFouls) {
      g.quarterFouls[g.quarter] = (g.quarterFouls[g.quarter] || 0) + 1;
    }
    calcolaPunteggi(g, sport);

    // Il riscontro sul gettone, non un avviso in mezzo allo schermo: chi segna
    // sta già guardando il giocatore, e un avviso coprirebbe il prossimo tocco.
    setLampo({ id: giocatore.id, testo: azione.score ? '+' + azione.score : azione.label });
    setTimeout(() => setLampo(l => (l && l.id === giocatore.id ? null : l)), 900);

    setScelto(null);
    aggiorna();
    salva();
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function sostituisci(entrante) {
    const uscente = g.players.find(p => p.id === sostituzione);
    if (!uscente || !entrante) return;
    memorizza();
    uscente.onCourt = false;
    entrante.onCourt = true;
    setSostituzione(null);
    aggiorna();
    salva();
  }

  const inCampo = g.players.filter(p => p.onCourt);
  const inPanca = g.players.filter(p => !p.onCourt);
  const falli = conf.teamFouls ? (g.quarterFouls[g.quarter] || 0) : 0;
  const bonus = conf.teamFouls && falli >= conf.teamFoulBonus;
  const giocatoreScelto = g.players.find(p => p.id === scelto);

  return (
    <div className="relative pb-4">
      {/* ============================================================ tabellone */}
      {/* Resta in cima mentre si scorre: è il numero che si controlla a ogni
          interruzione, e cercarlo scorrendo all'insù durante una partita è
          esattamente il gesto da togliere. */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 px-4 pt-1 sm:-mx-6 sm:px-6">
        <Pannello alto className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
            <div className="min-w-0 text-center">
              <div className="truncate text-[10px] font-bold uppercase tracking-etichetta text-tenue">
                {(state.teamProfile || {}).name}
              </div>
              <div className="mt-1 text-[clamp(30px,9vw,46px)] font-bold leading-none text-verde">
                {g.teamScore}
              </div>
            </div>

            <div className="px-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">
                {conf.period.short}{g.quarter}
              </div>
              {conf.teamFouls && (
                <div className={cx('mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  bonus ? 'bg-rosso/18 text-rosso' : 'bg-pannello/12 text-tenue')}>
                  {falli} falli{bonus ? ' · bonus' : ''}
                </div>
              )}
            </div>

            <div className="min-w-0 text-center">
              <div className="truncate text-[10px] font-bold uppercase tracking-etichetta text-tenue">
                {g.oppName}
              </div>
              <div className="mt-1 text-[clamp(30px,9vw,46px)] font-bold leading-none">
                {g.oppScore}
              </div>
            </div>
          </div>

          <div className="flex gap-px border-t border-bordo/10 bg-bordo/10">
            <button
              onClick={annulla}
              disabled={state.undoStack.length === 0}
              className="flex-1 bg-fondo/40 py-2.5 text-[12px] font-semibold text-soffuso transition-colors hover:text-testo disabled:opacity-35"
            >
              ↺ Annulla
            </button>
            <button
              onClick={() => setChiudiPeriodo(true)}
              className="flex-1 bg-fondo/40 py-2.5 text-[12px] font-semibold text-soffuso transition-colors hover:text-testo"
            >
              Chiudi {conf.period.label.toLowerCase()}
            </button>
            <button
              onClick={() => setFinePartita(true)}
              className="flex-1 bg-fondo/40 py-2.5 text-[12px] font-semibold text-ambra transition-colors hover:brightness-125"
            >
              Fine partita
            </button>
          </div>
        </Pannello>
      </div>

      {/* ========================================================= in campo */}
      <Etichetta className="mb-2.5">In campo · tocca per assegnare</Etichetta>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {inCampo.map(p => (
          <GettoneCampo
            key={p.id}
            p={p}
            sport={sport}
            lampo={lampo && lampo.id === p.id ? lampo.testo : null}
            inSostituzione={sostituzione === p.id}
            onAssegna={() => setScelto(p.id)}
            onSostituisci={() => setSostituzione(s => (s === p.id ? null : p.id))}
          />
        ))}
      </div>

      {/* ========================================================= panchina */}
      <Etichetta className="mb-2.5 mt-6">
        {sostituzione ? 'Chi entra?' : 'Panchina'}
      </Etichetta>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {inPanca.length === 0 ? (
          <p className="col-span-full text-[12.5px] text-tenue">Nessuno in panchina.</p>
        ) : inPanca.map(p => (
          <button
            key={p.id}
            onClick={() => (sostituzione ? sostituisci(p) : setScelto(p.id))}
            className={cx(
              'rounded-lg px-2 py-2.5 text-center transition-all orlo',
              sostituzione ? 'vetro-alto ring-1 ring-blu' : 'vetro hover:bg-pannello/12'
            )}
          >
            <div className="text-[15px] font-bold leading-none">{p.number}</div>
            <div className="mt-1 truncate text-[10.5px] text-tenue">{p.name.split(' ')[0]}</div>
          </button>
        ))}
      </div>
      {sostituzione && (
        <button
          onClick={() => setSostituzione(null)}
          className="mt-3 w-full rounded-lg vetro orlo py-2 text-[12px] font-semibold text-tenue hover:text-testo"
        >
          Annulla la sostituzione
        </button>
      )}

      <p className="mt-5 text-[11.5px] leading-relaxed text-tenue">
        Tocca un giocatore e poi l’azione: due tocchi, senza scorrere. Il ⇄ sul gettone
        prepara una sostituzione. Il punteggio avversario si scrive alla chiusura del{' '}
        {conf.period.label.toLowerCase()}, non canestro per canestro.
      </p>

      {/* ==================================================== pannello azioni */}
      {giocatoreScelto && (
        <PannelloAzioni
          p={giocatoreScelto}
          conf={conf}
          onAzione={(a) => esegui(giocatoreScelto, a)}
          onChiudi={() => setScelto(null)}
        />
      )}

      {chiudiPeriodo && (
        <ChiusuraPeriodo
          g={g}
          sport={sport}
          onChiudi={() => setChiudiPeriodo(false)}
          onFatto={(msg) => { aggiorna(); salva(); avvisa(msg); }}
        />
      )}

      {finePartita && (
        <Conferma
          titolo="Chiudere la partita?"
          testo={`${g.teamScore}–${g.oppScore} contro ${g.oppName}. Il tabellino va in archivio e non si modifica più.`
            + (g.calendarMatchId ? ' Il risultato torna anche sulla riga di calendario.' : '')}
          etichetta="Chiudi la partita"
          pericolo={false}
          onChiudi={() => setFinePartita(false)}
          onConferma={async () => {
            calcolaPunteggi(g, sport);
            if (!inCampione()) await endGame(g.id, g);
            if (g.calendarMatchId && !inCampione()) {
              // Se questo fallisce la partita è comunque archiviata: il
              // risultato si può sempre scrivere a mano dal calendario, ma
              // perdere il tabellino no.
              try {
                await updateCalendarMatch(g.calendarMatchId, {
                  team_score: g.teamScore, opp_score: g.oppScore, played: true
                });
              } catch (e) { console.error(e); }
            }
            state.liveGame = null;
            state.undoStack = [];
            onFinita();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- gettone in campo */
function GettoneCampo({ p, sport, lampo, inSostituzione, onAssegna, onSostituisci }) {
  const conf = sport.scout;
  const valore = conf.tileStat
    ? (conf.tileStat.key === 'pts' ? sport.score(p.stats || {}) : (p.stats || {})[conf.tileStat.key] || 0)
    : null;

  return (
    <div className="relative">
      <button
        onClick={onAssegna}
        className={cx(
          'w-full rounded-lg px-3 py-3.5 text-left transition-all orlo',
          inSostituzione ? 'vetro-alto ring-1 ring-blu' : 'vetro hover:bg-pannello/12 active:scale-[0.98]'
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[19px] font-bold leading-none">{p.number}</span>
          {/* La voce che il segnapunti controlla di continuo per accorgersi di
              aver sbagliato persona: sta grande e sempre nello stesso posto. */}
          {conf.tileStat && (
            <span className="ml-auto text-right leading-none">
              <b className="text-[19px] font-bold">{valore}</b>
              <i className="ml-1 text-[10px] font-bold uppercase not-italic tracking-etichetta text-tenue">
                {conf.tileStat.short}
              </i>
            </span>
          )}
        </div>
        <div className="mt-1.5 truncate text-[12.5px] font-semibold">{p.name}</div>
      </button>

      <button
        onClick={onSostituisci}
        title="Prepara la sostituzione"
        className={cx(
          'absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold transition-all',
          inSostituzione
            ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
            : 'vetro-alto orlo text-soffuso hover:text-testo'
        )}
      >
        ⇄
      </button>

      {/* Il riscontro dell'ultima azione, sopra il gettone di chi l'ha fatta. */}
      {lampo && (
        <span className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center">
          <span className="animate-salita rounded-full bg-gradient-to-br from-blu to-blu2 px-2.5 py-1 text-[11px] font-bold text-white shadow-blu">
            {lampo}
          </span>
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------- pannello azioni */
// Ancorato in basso e a tutta larghezza: il pollice arriva lì. I bottoni sono
// alti perché si tocca in piedi, guardando il campo e non lo schermo.
function PannelloAzioni({ p, conf, onAzione, onChiudi }) {
  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [onChiudi]);

  const tono = {
    made: 'bg-verde/16 text-verde hover:bg-verde/24',
    miss: 'bg-rosso/12 text-rosso hover:bg-rosso/20',
    warn: 'bg-ambra/14 text-ambra hover:bg-ambra/22',
    neutral: 'vetro text-testo hover:bg-pannello/16'
  };

  // Nel portale, per lo stesso motivo della Finestra: ancorato alla pagina e
  // non alla colonna, altrimenti il pollice non lo trova dove deve.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" onMouseDown={onChiudi}>
      <div className="absolute inset-0 bg-fondo/70 backdrop-blur-sm" />
      <div
        onMouseDown={e => e.stopPropagation()}
        className="relative max-h-[82dvh] overflow-y-auto rounded-t-2xl vetro-alto border-t border-bordo/12 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-lg animate-salita sm:px-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pannello/25" />

        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blu to-blu2 text-[17px] font-bold text-white shadow-blu">
            {p.number}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold leading-tight">{p.name}</div>
            <div className="text-[11.5px] text-tenue">{p.onCourt ? 'in campo' : 'in panchina'}</div>
          </div>
          <button
            onClick={onChiudi}
            className="shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold text-tenue hover:text-testo"
          >
            Chiudi
          </button>
        </div>

        <div className="space-y-3.5">
          {conf.groups.map(gr => (
            <div key={gr.label}>
              <Etichetta className="mb-1.5">{gr.label}</Etichetta>
              <div className={cx('grid gap-2', gr.layout === 'pair' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
                {gr.actions.map(a => (
                  <button
                    key={a.act}
                    onClick={() => onAzione(a)}
                    className={cx(
                      'rounded-lg px-3 py-3.5 text-[13px] font-semibold transition-all orlo active:scale-[0.97]',
                      tono[a.tone] || tono.neutral
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------- chiusura periodo */
function ChiusuraPeriodo({ g, sport, onChiudi, onFatto }) {
  const conf = sport.scout;
  const idx = g.quarter - 1;
  const esistente = (g.periodScores && g.periodScores[idx]) || null;

  // Il nostro punteggio del periodo è dedotto dalle azioni assegnate; quello
  // avversario lo copi dal tabellone, quindi è verità. Se ti è sfuggito un
  // canestro il nostro resta sbagliato per sempre — e senza un momento di
  // confronto non te ne accorgi mai. Questo È quel momento: stai già guardando
  // il tabellone, quindi il nostro totale te lo metto accanto.
  const nostriPrima = (g.periodScores || []).slice(0, idx)
    .reduce((n, x) => n + ((x && x.us) || 0), 0);
  const nostriOra = conf.ourScore === 'fromActions'
    ? g.players.reduce((n, p) => n + sport.score(p.stats || {}), 0) - nostriPrima
    : (esistente ? esistente.us : 0);

  const [loro, setLoro] = useState(esistente ? String(esistente.them) : '');
  const ultimo = g.quarter >= g.numQuarters;

  return (
    <Modulo
      titolo={`Chiudi ${conf.period.label.toLowerCase()} ${g.quarter}`}
      sotto={conf.periodPrompt}
      etichettaInvia={ultimo && !conf.period.allowExtra ? 'Salva' : `Vai al ${conf.period.label.toLowerCase()} ${g.quarter + 1}`}
      onChiudi={onChiudi}
      onInvia={async () => {
        if (loro === '') return 'Scrivi quanti punti ha segnato l’avversario.';
        const n = parseInt(loro, 10);
        if (isNaN(n) || n < 0) return 'Il punteggio non può essere negativo.';
        g.periodScores = g.periodScores || [];
        g.periodScores[idx] = { us: nostriOra, them: n };
        if (g.quarter < g.numQuarters || conf.period.allowExtra) {
          g.quarter += 1;
          if (g.quarter > g.numQuarters) g.numQuarters = g.quarter;
          if (conf.teamFouls) g.quarterFouls[g.quarter] = 0;
        }
        onFatto(`${conf.period.label} ${idx + 1} chiuso`);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-pannello/8 px-3.5 py-3 text-center">
          <Etichetta>Noi, dalle azioni</Etichetta>
          <div className="mt-2 text-[30px] font-bold leading-none text-verde">{nostriOra}</div>
        </div>
        <Campo etichetta={g.oppName}>
          <Testo
            inputMode="numeric"
            value={loro}
            onChange={e => setLoro(e.target.value.replace(/\D/g, ''))}
            className="text-center text-[26px] font-bold"
            autoFocus
          />
        </Campo>
      </div>

      <p className="text-[11.5px] leading-relaxed text-tenue">
        Confronta «noi» con il tabellone della palestra: se non coincidono è sfuggito un canestro,
        ed è adesso il momento di accorgersene. Puoi correggerlo annullando le ultime azioni.
      </p>

      {ultimo && conf.period.allowExtra && (
        <p className="rounded-lg bg-pannello/8 px-3.5 py-3 text-[12px] leading-relaxed text-soffuso">
          Era l’ultimo {conf.period.label.toLowerCase()} previsto. Se la partita è in parità,
          continuando si apre un {conf.period.extraLabel.toLowerCase()}; altrimenti chiudi la
          partita dal tabellone.
        </p>
      )}
    </Modulo>
  );
}
