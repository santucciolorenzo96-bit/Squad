import React, { useEffect, useMemo, useRef, useState } from 'react';
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
 * Tre regole, e vengono dal campo, non dal disegno:
 *
 * 1. DUE TOCCHI PER OGNI EVENTO — giocatore, poi azione — e mai uno scorrimento
 *    in mezzo. I comandi si aprono ancorati in basso, sotto il pollice. Nel
 *    basket si segna un evento ogni pochi secondi: ogni gesto in più si paga
 *    per tutta la partita.
 *
 * 1-bis. E DOVE IL GIOCO LO SA GIÀ, UNO SOLO. Dopo un errore al tiro arriva
 *    quasi sempre un rimbalzo; dopo un canestro, spesso un assist. Invece di
 *    far ricominciare da capo, l'app fa la domanda successiva da sola: si
 *    tocca chi ha preso il rimbalzo e si è già tornati al gioco.
 *
 *    Il tipo del rimbalzo non si chiede: se l'errore è nostro, un nostro
 *    rimbalzo è offensivo per definizione. Una domanda la cui risposta è
 *    deducibile dal contesto è una domanda di troppo — ed è il genere di
 *    domanda che, moltiplicata per una partita intera, fa chiudere l'app.
 *
 *    Le catene NON sono obbligatorie: si chiudono con un tocco fuori, e chi
 *    non le vuole segna come prima. Chi tiene lo scout cambia ogni volta, e
 *    una scorciatoia che si mette in mezzo a chi non la conosce è un ostacolo.
 *
 * 2. IL PUNTEGGIO AVVERSARIO SI SCRIVE A FINE PERIODO, non colpo su colpo.
 *    Inseguire i canestri altrui mentre si segue la propria squadra è la prima
 *    causa di tabellini sbagliati.
 *
 * Niente cronometro: nel basket si ferma troppo spesso perché valga la pena
 * inseguirlo, e i minuti contati male sono peggio dei minuti non contati.
 *
 * 3. SI VEDE IL CAMPO, non un elenco. Chi segna guarda la partita e poi lo
 *    schermo: deve ritrovare i giocatori dove li ha appena visti, non in
 *    ordine di numero. Nella pallavolo, poi, la posizione HA un nome — zona 1,
 *    zona 4 — ed è il nome con cui l'allenatore parla.
 *
 * E si segna quasi sempre da tablet: da lì in su campo e panchina stanno
 * affiancati, e i comandi si aprono ANCORATI al giocatore toccato invece che
 * in fondo allo schermo. Su un tablet «in fondo» è lontanissimo dal dito che
 * ha appena toccato, e il foglio dal basso copre metà campo.
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
  const [ancora, setAncora] = useState(null);      // da dove è stato toccato: il pannello nasce lì
  const [lampo, setLampo] = useState(null);        // { id, testo } riscontro dell'ultima azione
  const [catena, setCatena] = useState(null);      // { tipo, autore } la domanda successiva
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

  // Insieme allo stato si memorizza COSA si sta per annullare. Durante una
  // partita l'annulla si preme di fretta, e un pulsante che non dice cosa
  // toglie si preme due volte: la seconda cancella un evento buono.
  function memorizza(testo) {
    state.undoStack.push(JSON.stringify(g));
    state.undoTesti = state.undoTesti || [];
    state.undoTesti.push(testo || '');
    if (state.undoStack.length > 60) { state.undoStack.shift(); state.undoTesti.shift(); }
  }

  function annulla() {
    if (state.undoStack.length === 0) { avvisa('Niente da annullare'); return; }
    state.liveGame = JSON.parse(state.undoStack.pop());
    if (state.undoTesti) state.undoTesti.pop();
    setScelto(null);
    setAncora(null);
    setCatena(null);
    aggiorna();
    salva();
  }

  const daAnnullare = (state.undoTesti || [])[(state.undoTesti || []).length - 1] || '';

  function esegui(giocatore, azione, senzaCatena) {
    memorizza(giocatore.number + ' ' + (azione.etichettaBreve || azione.label));
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
    setAncora(null);
    aggiorna();
    salva();
    if (navigator.vibrate) navigator.vibrate(12);

    // La domanda successiva, se il gioco ne ha una. Arriva dopo il riscontro
    // sul gettone, non al posto suo: si deve vedere che il primo evento e'
    // stato preso, altrimenti si segna due volte per il dubbio.
    const seguito = !senzaCatena && azione.poi && (conf.chains || {})[azione.poi];
    setCatena(seguito ? { tipo: azione.poi, autore: giocatore.id } : null);
  }

  function rispondiCatena(giocatore) {
    const c = (conf.chains || {})[catena.tipo];
    setCatena(null);
    if (!giocatore || !c) return;
    esegui(giocatore, { ...c.azione, etichettaBreve: c.azione.label }, true);
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
              {g.friendly && (
                <div className="mt-1.5 rounded-full bg-pannello/14 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-etichetta text-tenue">
                  amichevole
                </div>
              )}
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
              className="min-w-0 flex-1 bg-fondo/40 px-2 py-2.5 text-[12px] font-semibold text-soffuso transition-colors hover:text-testo disabled:opacity-35"
            >
              <span className="block truncate">
                ↺ Annulla{daAnnullare ? <span className="text-tenue"> · {daAnnullare}</span> : null}
              </span>
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

      {/* ============================================== campo e panchina */}
      {/* Affiancati da tablet in su: è lì che si segna quasi sempre, e due
          colonne tolgono lo scorrimento proprio mentre il gioco corre. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">

        <div>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <Etichetta>{sport.field.onFieldLabel} · tocca per assegnare</Etichetta>
            <span className="text-[11.5px] text-tenue">{inCampo.length} di {sport.match.minOnField}</span>
          </div>

          <Pannello alto className="overflow-hidden">
            <div className="campo campo-scout parquet relative w-full">
              <RigheCampo svg={sport.field.svg} />
              {inCampo.map((p, i) => {
                const posto = sport.field.slots[i];
                return (
                  <GettoneCampo
                    key={p.id}
                    p={p}
                    sport={sport}
                    lampo={lampo && lampo.id === p.id ? lampo.testo : null}
                    inSostituzione={sostituzione === p.id}
                    stile={posto ? { top: posto.top, left: posto.left } : undefined}
                    onAssegna={(e) => { setAncora(e.currentTarget.getBoundingClientRect()); setScelto(p.id); }}
                    onSostituisci={() => setSostituzione(s => (s === p.id ? null : p.id))}
                  />
                );
              })}
            </div>
          </Pannello>
        </div>

        <div className="mt-6 md:mt-0">
          <Etichetta className="mb-2.5">
            {sostituzione ? 'Chi entra?' : sport.field.benchLabel}
          </Etichetta>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-2">
            {inPanca.length === 0 ? (
              <p className="col-span-full text-[12.5px] text-tenue">Nessuno in panchina.</p>
            ) : inPanca.map(p => (
              <button
                key={p.id}
                onClick={(e) => {
                  if (sostituzione) { sostituisci(p); return; }
                  setAncora(e.currentTarget.getBoundingClientRect());
                  setScelto(p.id);
                }}
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

          <p className="mt-4 text-[11.5px] leading-relaxed text-tenue">
            Tocca un giocatore e poi l’azione. Dopo un tiro sbagliato l’app chiede subito chi ha
            preso il rimbalzo, e dopo un canestro se c’era un assist: rispondi con un tocco, o
            tocca fuori per saltare. Il ⇄ sul gettone prepara una sostituzione. Il punteggio
            avversario si scrive alla chiusura del {conf.period.label.toLowerCase()}.
          </p>
        </div>
      </div>

      {/* ======================================================= la catena */}
      {catena && (
        <Catena
          conf={conf}
          catena={catena}
          giocatori={g.players.filter(x => x.onCourt)}
          onScegli={rispondiCatena}
          onChiudi={() => setCatena(null)}
        />
      )}

      {/* ==================================================== pannello azioni */}
      {giocatoreScelto && (
        <PannelloAzioni
          p={giocatoreScelto}
          conf={conf}
          ancora={ancora}
          onAzione={(a) => esegui(giocatoreScelto, a)}
          onChiudi={() => { setScelto(null); setAncora(null); }}
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
            state.undoTesti = [];
            onFinita();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- le righe */
// Il disegno del campo non cambia mai durante una partita, ma sta dentro una
// schermata che si ridisegna a ogni tocco. Memorizzato, il browser smette di
// rileggere e ricostruire l'SVG ogni volta che qualcuno segna un canestro.
const RigheCampo = React.memo(function RigheCampo({ svg }) {
  return <div className="righe-campo" dangerouslySetInnerHTML={{ __html: svg }} />;
});

/* ---------------------------------------------------------- gettone in campo */
// Sul parquet, alla sua posizione. I colori sono fissi e non seguono il tema:
// il legno è scuro in tutti e due, e un gettone chiaro in tema chiaro sparirebbe.
//
// Memorizzato: quando si segna un canestro cambia UN giocatore, e ridisegnare
// gli altri quattro è lavoro che si paga a ogni tocco per tutta la partita.
const GettoneCampo = React.memo(function GettoneCampo({
  p, sport, lampo, inSostituzione, stile, onAssegna, onSostituisci
}) {
  const conf = sport.scout;
  const valore = conf.tileStat
    ? (conf.tileStat.key === 'pts' ? sport.score(p.stats || {}) : (p.stats || {})[conf.tileStat.key] || 0)
    : null;

  return (
    <div
      style={stile}
      className="gettone-scout absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
    >
      {/* La voce che chi segna controlla di continuo per accorgersi di aver
          sbagliato persona: sopra la testa, sempre nello stesso posto. */}
      {conf.tileStat && (
        <span className="su-legno-lieve mb-1 rounded-full px-1.5 py-0.5 text-center leading-none">
          <b className="block font-bold text-white" style={{ fontSize: 'var(--media)' }}>
            {valore}
            <i className="ml-0.5 font-bold not-italic text-white/60">{conf.tileStat.short}</i>
          </b>
        </span>
      )}

      <div className="relative">
        <button
          onClick={onAssegna}
          title={p.name}
          className={cx(
            'grid place-items-center rounded-full font-bold text-white ring-2 transition-all active:scale-95',
            'su-legno',
            inSostituzione ? 'ring-blu shadow-blu' : 'ring-white/70'
          )}
          style={{ width: 'var(--volto)', height: 'var(--volto)', fontSize: 'var(--numero)' }}
        >
          {p.number}
        </button>

        <button
          onClick={onSostituisci}
          title="Prepara la sostituzione"
          className={cx(
            'absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-all',
            inSostituzione
              ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              : 'su-legno text-white/80 ring-1 ring-white/40 hover:text-white'
          )}
        >
          ⇄
        </button>

        {/* Il riscontro dell'ultima azione, sopra il gettone di chi l'ha fatta. */}
        {lampo && (
          <span className="pointer-events-none absolute inset-x-0 -top-3 flex justify-center">
            <span className="animate-salita whitespace-nowrap rounded-full bg-gradient-to-br from-blu to-blu2 px-2 py-0.5 text-[10px] font-bold text-white shadow-blu">
              {lampo}
            </span>
          </span>
        )}
      </div>

      <div
        className="mt-1 max-w-full truncate font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.85)]"
        style={{ fontSize: 'var(--nome)' }}
      >
        {p.name.split(' ')[0]}
      </div>
    </div>
  );
});

/* --------------------------------------------------------------- la catena */
// La domanda successiva. Sta in basso come il pannello delle azioni, ma e'
// piu' bassa e non copre il campo: si risponde guardando ancora il gioco.
//
// Non ha un pulsante "annulla" e non ne ha bisogno: toccare fuori la chiude, e
// chiuderla non perde niente — l'evento di partenza e' gia' registrato.
function Catena({ conf, catena, giocatori, onScegli, onChiudi }) {
  const c = (conf.chains || {})[catena.tipo];

  // L'effetto sta PRIMA di qualunque uscita anticipata: un hook dentro un ramo
  // condizionale cambia l'ordine degli hook fra un disegno e l'altro, ed e' il
  // genere di difetto che esplode molto dopo, in un punto che non c'entra.
  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [onChiudi]);

  if (!c) return null;

  const candidati = c.includiAutore
    ? giocatori
    : giocatori.filter(p => p.id !== catena.autore);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col justify-end" onMouseDown={onChiudi}>
      {/* Niente sfocatura sul fondo: qui la domanda dura due secondi e il campo
          deve restare visibile dietro. */}
      <div
        onMouseDown={e => e.stopPropagation()}
        className="relative rounded-t-2xl vetro-alto border-t border-bordo/12 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 shadow-lg animate-salita sm:px-6"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <Etichetta>{c.titolo}</Etichetta>
          <button
            onClick={onChiudi}
            className="shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-tenue hover:text-testo"
          >
            {c.altro}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {candidati.map(p => (
            <button
              key={p.id}
              onClick={() => onScegli(p)}
              className="rounded-lg vetro orlo px-1 py-2.5 text-center transition-all hover:bg-pannello/16 active:scale-[0.97]"
            >
              <div className="text-[17px] font-bold leading-none">{p.number}</div>
              <div className="mt-1 truncate text-[10px] text-tenue">{p.name.split(' ')[0]}</div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------- pannello azioni */
/* Da dove nasce il pannello.
 *
 * Su telefono dal basso, a tutta larghezza: il pollice arriva lì e lo schermo
 * è stretto comunque.
 *
 * Da tablet in su ANCORATO al giocatore toccato, come se uscisse da lui. Su un
 * tablet «in fondo allo schermo» è a venti centimetri dal dito che ha appena
 * toccato, e un foglio a tutta larghezza copre il campo proprio mentre la
 * partita va avanti. Il pannello si apre accanto al gettone, si ribalta sopra
 * o sotto a seconda dello spazio, e resta dentro i bordi.
 */
function PannelloAzioni({ p, conf, ancora, onAzione, onChiudi }) {
  const [posa, setPosa] = useState(null);   // { left, top, maxH, origine } oppure null = foglio
  const largo = !!posa;

  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [onChiudi]);

  // La posizione si calcola una volta, all'apertura: il gettone non si muove
  // mentre il pannello è aperto, e ricalcolare a ogni disegno vorrebbe dire
  // farlo ballare sotto il dito.
  useEffect(() => {
      const L = 34 * 16;                      // larghezza del pannello, in pixel
    const grande = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (!grande || !ancora) { setPosa(null); return; }

    const margine = 12;
    const sopra = ancora.top;
    const sotto = window.innerHeight - ancora.bottom;
    const verso = sotto >= sopra ? 'giu' : 'su';
    const spazio = (verso === 'giu' ? sotto : sopra) - margine * 2;

    const left = Math.min(
      Math.max(ancora.left + ancora.width / 2 - L / 2, margine),
      window.innerWidth - L - margine
    );

    setPosa({
      left,
      top: verso === 'giu' ? ancora.bottom + margine : null,
      bottom: verso === 'su' ? window.innerHeight - ancora.top + margine : null,
      maxH: Math.max(spazio, 240),
      // L'origine della crescita è il gettone: l'occhio segue il movimento e
      // capisce da cosa è uscito il pannello.
      origine: (ancora.left + ancora.width / 2 - left) + 'px ' + (verso === 'giu' ? '0%' : '100%')
    });
  }, [ancora]);

  const corpo = (
    <>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blu to-blu2 text-[16px] font-bold text-white shadow-blu">
          {p.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">{p.name}</div>
          <div className="text-[11.5px] text-tenue">{p.onCourt ? 'in campo' : 'in panchina'}</div>
        </div>
        <button
          onClick={onChiudi}
          className="shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold text-tenue hover:text-testo"
        >
          Chiudi
        </button>
      </div>

      {/* Nel pannello ancorato i gruppi stanno su due colonne: con diciotto
          azioni in colonna unica il pannello diventa piu' alto dello schermo e
          copre il campo, che e' la cosa che si stava guardando. */}
      <div className={cx(largo ? 'grid grid-cols-2 gap-x-3 gap-y-3' : 'space-y-3')}>
        {conf.groups.map(gr => (
          <div key={gr.label}>
            <Etichetta className="mb-1.5">{gr.label}</Etichetta>
            <div className={cx('grid gap-2', gr.layout === 'pair' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
              {gr.actions.map(a => (
                <button
                  key={a.act}
                  onClick={() => onAzione(a)}
                  className={cx(
                    'rounded-lg px-3 py-3 text-[13px] font-semibold transition-all orlo active:scale-[0.97]',
                    TONO_AZIONE[a.tone] || TONO_AZIONE.neutral
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  // Nel portale, per lo stesso motivo della Finestra: ancorato alla pagina e
  // non alla colonna, altrimenti finisce dove non deve.
  if (posa) {
    return createPortal(
      <div className="fixed inset-0 z-[70]" onMouseDown={onChiudi}>
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            left: posa.left,
            top: posa.top != null ? posa.top : undefined,
            bottom: posa.bottom != null ? posa.bottom : undefined,
            maxHeight: posa.maxH,
            transformOrigin: posa.origine
          }}
          className="animate-nascita fixed w-[34rem] overflow-y-auto rounded-2xl vetro-alto orlo px-4 py-4 shadow-lg"
        >
          {corpo}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" onMouseDown={onChiudi}>
      <div className="absolute inset-0 bg-fondo/70 backdrop-blur-sm" />
      <div
        onMouseDown={e => e.stopPropagation()}
        className="relative max-h-[82dvh] overflow-y-auto rounded-t-2xl vetro-alto border-t border-bordo/12 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-lg animate-salita sm:px-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pannello/25" />
        {corpo}
      </div>
    </div>,
    document.body
  );
}

const TONO_AZIONE = {
  made: 'bg-verde/16 text-verde hover:bg-verde/24',
  miss: 'bg-rosso/12 text-rosso hover:bg-rosso/20',
  warn: 'bg-ambra/14 text-ambra hover:bg-ambra/22',
  neutral: 'vetro text-testo hover:bg-pannello/16'
};

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
