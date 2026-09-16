import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { state } from '../state.js';
import { saveLiveGame, endGame } from '../api/games.js';
import { updateCalendarMatch } from '../api/calendar.js';
import { currentSport } from '../utils/sports/index.js';
import {
  situazionePeriodo, etichettaPalla, partitaDecisa, periodiMassimi,
  perchePunteggioImpossibile, scambioFinito,
  saldoTurno, sommaQuintetto
} from '../utils/regole.js';
import { Pannello, Etichetta, Pulsante, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso } from './moduli.jsx';
import { inCampione } from './campione.js';
import { scriviCopia, segnaSincronizzata, cancellaCopia } from './partitaLocale.js';

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

// Il numero di maglia non c'e' sempre: in un'anagrafica vera ci sono atleti
// senza numero assegnato, e in campo comparivano come un trattino. Un trattino
// non identifica nessuno — cinque trattini in panchina sono cinque sconosciuti.
// Al posto suo le iniziali, che almeno si legano al nome scritto sotto.
function sigla(p) {
  const n = String(p.number == null ? '' : p.number).trim();
  if (/\d/.test(n)) return n;
  const parti = String(p.name || '').trim().split(/\s+/).filter(Boolean);
  if (!parti.length) return '?';
  const primo = parti[0][0];
  return (parti.length > 1 ? primo + parti[parti.length - 1][0] : primo).toUpperCase();
}

// Quanti periodi sono FINITI.
//
// Di solito sono quelli prima di quello in corso. Ma l'ultimo set di una
// partita gia' decisa si chiude senza aprirne un altro — il sesto set non
// esiste — e allora il numero del set in corso non basta piu' a dirlo: senza
// questo, una partita vinta 3-0 mostrava 2-0.
function quantiChiusi(g) {
  return Math.max(g.chiusi || 0, Math.max(0, (g.quarter || 1) - 1));
}

const CHIAVE_DETTAGLIO = 'squad_scout_dettaglio';

function leggiDettaglio() {
  try { return window.localStorage.getItem(CHIAVE_DETTAGLIO) === '1'; }
  catch (e) { return false; }
}

function ricordaDettaglio(v) {
  try { window.localStorage.setItem(CHIAVE_DETTAGLIO, v ? '1' : '0'); }
  catch (e) { /* niente */ }
}

// La mappa dei tiri e' spenta di serie, e la scelta e' di chi segna: resta
// sul suo dispositivo e vale anche per la partita dopo.
const CHIAVE_MAPPA = 'squad_scout_mappa';

function leggiMappa() {
  try { return window.localStorage.getItem(CHIAVE_MAPPA) === '1'; }
  catch (e) { return false; }
}

function ricordaMappa(v) {
  try { window.localStorage.setItem(CHIAVE_MAPPA, v ? '1' : '0'); }
  catch (e) { /* niente */ }
}

function calcolaPunteggi(g, sport) {
  const conf = sport.scout;
  const periodi = g.periodScores || [];
  if (conf.scoreDisplay === 'setsWon') {
    const chiusi = periodi.slice(0, quantiChiusi(g));
    g.teamScore = chiusi.filter(x => x && x.us > x.them).length;
    g.oppScore = chiusi.filter(x => x && x.them > x.us).length;
    return;
  }
  g.teamScore = conf.ourScore === 'fromActions'
    ? g.players.reduce((n, p) => n + sport.score(p.stats || {}), 0)
    : periodi.reduce((n, x) => n + ((x && x.us) || 0), 0);
  g.oppScore = periodi.reduce((n, x) => n + ((x && x.them) || 0), 0);
}

export function Tracker({ onFinita, onEsci }) {
  const sport = currentSport();
  const conf = sport.scout;
  const avvisa = useAvviso();

  const [, ridisegna] = useState(0);
  const [scelto, setScelto] = useState(null);      // id giocatore col pannello aperto
  const [ancora, setAncora] = useState(null);      // da dove è stato toccato: il pannello nasce lì
  const [lampo, setLampo] = useState(null);        // { id, testo } riscontro dell'ultima azione
  const [catena, setCatena] = useState(null);      // { tipo, autore } la domanda successiva
  const [sostituzione, setSostituzione] = useState(null);
  // Quanto dettaglio vuole chi sta segnando. E' una preferenza sua, non della
  // partita: resta sul suo dispositivo e vale anche per la prossima volta.
  const [dettaglio, setDettaglio] = useState(leggiDettaglio);
  const [mappa, setMappa] = useState(leggiMappa);
  const [tiroDaPiazzare, setTiroDaPiazzare] = useState(null);   // { giocatore, azione }
  const [chiudiPeriodo, setChiudiPeriodo] = useState(false);
  const [finePartita, setFinePartita] = useState(false);
  const salvataggioRotto = useRef(false);
  const riprova = useRef(null);

  // Chiudere la scheda con del lavoro non ancora spedito e' l'unico momento in
  // cui l'app puo' ancora avvisare. Il browser mostra il suo avviso, non il
  // nostro: e' poco, ma e' l'unica cosa che passa.
  useEffect(() => {
    const chiede = (e) => {
      if (!salvataggioRotto.current) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', chiede);
    return () => {
      window.removeEventListener('beforeunload', chiede);
      clearTimeout(riprova.current);
    };
  }, []);

  // Si riapre una partita ripresa dalla copia locale: il primo tentativo di
  // rimetterla in rete parte subito, senza aspettare la prossima azione.
  useEffect(() => {
    if (g && g.daRisincronizzare) { delete g.daRisincronizzare; salva(); }
  }, []);

  // A schermo intero la pagina sotto non deve scorrere: due superfici che
  // scorrono una dentro l'altra, su un tablet tenuto in mano, vuol dire
  // perdere il campo mentre si cerca un pulsante.
  useEffect(() => {
    if (!onEsci) return undefined;
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, [onEsci]);

  const g = state.liveGame;
  if (!g) return null;
  if (!g.periodScores) g.periodScores = [];
  calcolaPunteggi(g, sport);

  const aggiorna = () => ridisegna(n => n + 1);

  // Il salvataggio gira a ogni azione senza bloccare niente.
  //
  // PRIMA in locale, POI in rete. La scrittura nel browser e' immediata e non
  // dipende dal segnale: quando la rete manca — ed e' la regola, in palestra —
  // la partita smette di esistere solo in memoria. Il server resta la verita'
  // condivisa, ma non e' piu' l'unico posto dove il lavoro esiste.
  //
  // Se la rete non risponde si avvisa una volta sola e si riprova da soli ogni
  // dieci secondi: chi sta segnando non deve ricordarsi di riprovare, e se si
  // ferma a guardare la partita senza toccare niente non ci sarebbe nessuna
  // azione a fare da innesco.
  function salva() {
    const timbro = scriviCopia(g);
    if (inCampione()) return;   // niente database dietro: non c'e' dove salvare
    clearTimeout(riprova.current);
    saveLiveGame(g.id, g).then(() => {
      segnaSincronizzata(g.sectorId, timbro);
      if (salvataggioRotto.current) {
        salvataggioRotto.current = false;
        avvisa('Salvataggio ripreso');
      }
    }).catch(e => {
      console.error(e);
      if (!salvataggioRotto.current) {
        salvataggioRotto.current = true;
        avvisa('Rete assente: la partita e’ al sicuro su questo dispositivo e riparte da sola.', 'errore');
      }
      riprova.current = setTimeout(() => { if (salvataggioRotto.current) salva(); }, 10000);
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

  function esegui(giocatore, azione, senzaCatena, punto) {
    memorizza(sigla(giocatore) + ' ' + (azione.etichettaBreve || azione.label));
    const s = giocatore.stats;
    // Quanto vale questa azione in punti lo dice lo sport, non l'azione: nel
    // basket sta scritto (2, 3, 1), nella pallavolo e' un `points: 1` dentro le
    // statistiche. Si misura la differenza prima e dopo, e va bene per tutti.
    const primaPunti = sport.score(s || {});
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

    // Da dove e' partito il tiro, quando qualcuno l'ha detto. Sta dentro il
    // giocatore perche' e' suo, e perche' cosi' viaggia con il tabellino.
    if (punto) {
      s.tiri = [...(s.tiri || []), {
        x: punto.x, y: punto.y, act: azione.act, dentro: !!azione.dentro, q: g.quarter || 1
      }];
    }

    // Il punteggio del periodo in corso cresce subito: e' il numero che chi
    // segna confronta col tabellone della palestra, e un numero che si aggiorna
    // solo a fine set non serve a confrontare niente.
    const guadagnati = sport.score(s || {}) - primaPunti;
    if (guadagnati) {
      segnaPeriodo('us', guadagnati);
      chiudiScambio('us');
    }

    // I nostri errori sono punti loro: e' la regola del gioco, e finora la
    // doveva applicare a mano chi segnava — due tocchi per un evento solo, e
    // quello dimenticato falsava il punteggio senza dirlo.
    if (azione.puntoLoro) {
      segnaPeriodo('them', 1);
      chiudiScambio('them');
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

  // Il punteggio del periodo in corso, da una parte o dall'altra.
  //
  // Serve per forza in due casi che non passano dalle azioni dei nostri: i
  // punti che l'avversario fa — e che nessuno di noi ha "prodotto" — e, nella
  // pallavolo, i punti che prendiamo NOI per un errore avversario, che non si
  // possono assegnare a nessun giocatore. Senza questo, quel punteggio
  // resterebbe fermo per tutto il set.
  function segnaPeriodo(lato, delta) {
    const idx = (g.quarter || 1) - 1;
    g.periodScores = g.periodScores || [];
    const riga = g.periodScores[idx] || { us: 0, them: 0 };
    const nuovo = Math.max(0, (riga[lato] || 0) + delta);
    if (nuovo === riga[lato] && delta < 0) return;      // gia' a zero: niente da togliere
    // Si copia la riga invece di rifarla: dentro ci sono anche chi batte, la
    // rotazione e i conti delle fasi, e riscriverla da zero li cancellerebbe.
    g.periodScores[idx] = { ...riga, [lato]: nuovo };
  }

  function manoPunteggio(lato, delta) {
    memorizza((lato === 'us' ? 'Noi' : g.oppName) + ' ' + (delta > 0 ? '+' + delta : '−' + Math.abs(delta)));
    segnaPeriodo(lato, delta);
    // Solo il piu' chiude uno scambio. Il meno e' una correzione, e una
    // correzione non ha una fase ne' una rotazione: per disfare uno scambio
    // c'e' l'Annulla, che rimette indietro tutto insieme.
    if (delta > 0) chiudiScambio(lato);
    calcolaPunteggi(g, sport);
    aggiorna();
    salva();
    if (navigator.vibrate) navigator.vibrate(8);
  }

  /* La rotazione.
   *
   * Nella pallavolo si gira di un posto quando si conquista il servizio: chi
   * stava in zona 1 va in 6, e tutti gli altri avanzano. Le posizioni qui sono
   * l'ORDINE dei giocatori in campo — il primo sta in zona 1 — quindi girare
   * vuol dire spostare il primo in fondo.
   *
   * A mano e non da sola: l'app potrebbe dedurre il cambio di servizio dal
   * punto precedente, ma basta un punto sfuggito a inizio set per sfasare tutti
   * e sei fino alla fine, in silenzio. Chi segna sa quando si gira, e girare
   * costa un tocco.
   */
  // Lo spostamento vero: chi era in zona 1 va in fondo. Staccato dal pulsante
  // perche' adesso lo chiama anche il motore degli scambi.
  function giraSestetto() {
    const campo = g.players.filter(p => p.onCourt);
    if (campo.length < 2) return false;
    const girati = campo.slice(1).concat([campo[0]]);
    let k = 0;
    g.players = g.players.map(p => (p.onCourt ? girati[k++] : p));
    return true;
  }

  function ruota() {
    if (!giraSestetto()) return;
    memorizza('Rotazione');
    const idx = (g.quarter || 1) - 1;
    g.periodScores = g.periodScores || [];
    const riga = g.periodScores[idx] || { us: 0, them: 0 };
    g.periodScores[idx] = { ...riga, rot: ((riga.rot || 1) % 6) + 1 };
    aggiorna();
    salva();
    if (navigator.vibrate) navigator.vibrate(8);
  }

  // Lo scambio finito: la regola sta in regole.js, qui si applica. Chiudere
  // uno scambio vuol dire tre cose insieme — la fase, la rotazione, e chi
  // battera' il prossimo — e sono tre cose che val la pena poter provare da
  // sole, senza una partita intorno.
  function chiudiScambio(lato) {
    if (!conf.scambi) return;
    const idx = (g.quarter || 1) - 1;
    g.periodScores = g.periodScores || [];
    const esito = scambioFinito(g.periodScores[idx] || { us: 0, them: 0 }, lato);
    if (!esito) return;                 // non sappiamo chi batteva: non si conta
    if (esito.gira) giraSestetto();
    g.periodScores[idx] = esito.riga;
  }

  // La risposta alla domanda di inizio set. Da qui in poi non si chiede piu'
  // niente: chi vince lo scambio serve il successivo.
  function iniziaServizio(lato) {
    memorizza(lato === 'us' ? 'Battiamo noi' : 'Battono loro');
    const idx = (g.quarter || 1) - 1;
    g.periodScores = g.periodScores || [];
    const riga = g.periodScores[idx] || { us: 0, them: 0 };
    g.periodScores[idx] = { ...riga, serve: lato, rot: riga.rot || 1 };
    aggiorna();
    salva();
  }

  /* IL REGISTRO DEI QUINTETTI.
   *
   * La domanda che un allenatore si fa a fine partita non e' quanto ha segnato
   * Rossi: e' con quali cinque in campo siamo andati meglio. E' l'unica
   * statistica che parla del gioco invece delle prestazioni, ed e' quella su
   * cui si decide chi entra nel finale punto a punto.
   *
   * Non costa un tocco in piu'. I cambi si segnano gia' e il punteggio si
   * muove gia': basta ricordare com'era il tabellone quando quei cinque sono
   * entrati. La differenza, quando uno esce, e' il loro saldo.
   *
   * Un turno si chiude a ogni cambio, a fine periodo e a fine partita. */
  function apriTurno() {
    if (!conf.quintetti) return;
    g.turno = {
      ids: g.players.filter(p => p.onCourt).map(p => p.id),
      us: g.teamScore || 0,
      them: g.oppScore || 0
    };
  }

  function chiudiTurno() {
    if (!conf.quintetti) return;
    calcolaPunteggi(g, sport);
    const esito = saldoTurno(g.turno, g.teamScore, g.oppScore);
    if (esito) {
      g.quintetti = sommaQuintetto(g.quintetti, esito);
      // Lo stesso saldo va anche sulle cinque persone: e' il loro piu'/meno.
      esito.ids.forEach(id => {
        const p = g.players.find(x => x.id === id);
        if (p) p.stats = { ...(p.stats || {}), plusMinus: ((p.stats || {}).plusMinus || 0) + esito.saldo };
      });
    }
    g.turno = null;
  }

  // All'apertura dello scout il quintetto e' gia' in campo da prima: se non
  // c'e' un turno aperto se ne apre uno adesso, altrimenti i primi canestri
  // non sarebbero di nessuno.
  useEffect(() => {
    if (!conf.quintetti || g.turno) return;
    calcolaPunteggi(g, sport);
    apriTurno();
    salva();
    // Una volta sola, all'apertura: dopo ci pensano i cambi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sostituisci(entrante) {
    const uscente = g.players.find(p => p.id === sostituzione);
    if (!uscente || !entrante) return;
    memorizza();
    // Prima si chiude il conto dei cinque che c'erano, poi si cambia: al
    // contrario, i punti appena fatti finirebbero a chi e' appena entrato.
    chiudiTurno();
    uscente.onCourt = false;
    entrante.onCourt = true;
    apriTurno();
    setSostituzione(null);
    aggiorna();
    salva();
  }

  const inCampo = g.players.filter(p => p.onCourt);
  const inPanca = g.players.filter(p => !p.onCourt);
  const falli = conf.teamFouls ? (g.quarterFouls[g.quarter] || 0) : 0;
  const bonus = conf.teamFouls && falli >= conf.teamFoulBonus;
  const giocatoreScelto = g.players.find(p => p.id === scelto);

  // Il periodo in corso. Nella pallavolo e' il punteggio che si vede in grande;
  // nel basket serve alla chiusura del quarto, dove si confronta col tabellone
  // della palestra.
  const inCorso = (g.periodScores || [])[(g.quarter || 1) - 1] || { us: 0, them: 0 };

  // UN SOLO PUNTEGGIO GRANDE, e vivo.
  //
  // Chi segna guarda un numero solo, e quel numero deve essere quello che sta
  // sul tabellone della palestra in questo momento. Nella pallavolo quel numero
  // e' il punteggio DEL SET: i set vinti sono la storia della partita, non il
  // gioco in corso, e vanno in mezzo, piccoli. Nel basket e nel calcio e' il
  // totale, che cresce gia' da solo azione dopo azione.
  const perSet = conf.scoreDisplay === 'setsWon';
  const grandeNostro = perSet ? inCorso.us : g.teamScore;
  const grandeLoro = perSet ? inCorso.them : g.oppScore;

  // I periodi gia' chiusi, in riga e in piccolo: il parziale quarto per quarto
  // (o set per set) e' la cosa che si guarda dopo il punteggio, mai prima.
  const chiusi = (g.periodScores || []).slice(0, quantiChiusi(g));
  const parziali = chiusi.filter(Boolean).map(x => x.us + '-' + x.them).join('  ·  ');

  // DOVE STA IL SET, secondo il regolamento dello sport.
  //
  // Nella pallavolo il set finisce quando lo dicono i numeri, non quando
  // finisce un tempo: l'app puo' saperlo, e saperlo cambia due cose in
  // panchina — si sa che si e' a un punto dalla fine, e non si continua a
  // segnare per tre scambi dentro un set gia' chiuso. Nel basket non c'e'
  // nessuna regola da sapere, e qui non compare niente.
  // Lo scambio in corso: chi batte, in che rotazione siamo, come stanno le due
  // fasi. Vale solo dove ogni punto chiude uno scambio — nel basket e' null e
  // dalla testata non compare niente.
  const scambi = conf.scambi ? {
    serve: inCorso.serve || null,
    rot: inCorso.rot || 1,
    so: { v: inCorso.soV || 0, t: inCorso.soT || 0 },
    bp: { v: inCorso.bpV || 0, t: inCorso.bpT || 0 }
  } : null;
  const pct = (x) => (x.t ? Math.round((x.v / x.t) * 100) : null);

  const decisa = partitaDecisa(conf, chiusi);
  const inCorsoDaChiudere = quantiChiusi(g) < (g.quarter || 1);
  const situazione = inCorsoDaChiudere
    ? situazionePeriodo(conf, g.quarter || 1, inCorso.us, inCorso.them)
    : null;
  const nostroNome = (state.teamProfile || {}).name || 'Noi';
  let avviso = null;
  if (decisa && decisa.finita) {
    // Non c'e' piu' niente da segnare: l'unica cosa che resta da fare e'
    // archiviare, e va detto invece di lasciare un tabellone che sembra vivo.
    avviso = { finito: true, chiusa: true, testo: 'Partita finita ' + decisa.us + '–' + decisa.them };
  } else if (situazione && situazione.stato === 'palla') {
    avviso = {
      finito: false,
      testo: etichettaPalla(conf, situazione, chiusi)
        + ' · ' + (situazione.chi === 'us' ? nostroNome : g.oppName)
    };
  } else if (situazione && situazione.stato === 'chiuso') {
    avviso = {
      finito: true,
      testo: conf.period.label + ' finito ' + inCorso.us + '–' + inCorso.them
    };
  }
  // I nostri punti si possono aggiungere a mano solo dove NON appartengono a
  // un giocatore: nella pallavolo un errore avversario e' un punto nostro che
  // non ha autore. Nel basket ogni punto ha un autore, e una mano libera sul
  // punteggio sarebbe solo un modo per falsare il tabellino.
  const manoNostra = conf.ourScore === 'perPeriod' && !(decisa && decisa.finita);
  const manoLoro = !(decisa && decisa.finita);

  const corpo = (
    <div className="relative pb-4">
      {/* ============================================================ tabellone */}
      {/* Resta in cima mentre si scorre: è il numero che si controlla a ogni
          interruzione, e cercarlo scorrendo all'insù durante una partita è
          esattamente il gesto da togliere. */}
      <div className={cx(
        'sticky top-0 z-20 -mx-4 mb-4 px-4 pt-1 sm:-mx-6 sm:px-6',
        onEsci && 'bg-fondo/85 pb-1 backdrop-blur-sm'
      )}>
        {/* La via d'uscita sta dentro la parte che resta in cima: se scorresse
            via, per uscire da una partita bisognerebbe prima ritrovarla. */}
        {onEsci && (
          <div className="mb-1.5 flex items-center justify-between gap-3 pt-[env(safe-area-inset-top)]">
            <button
              onClick={onEsci}
              className="-ml-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-tenue transition-colors hover:text-testo"
            >
              ‹ Esci dallo scout
            </button>
            <span className="truncate text-[12px] text-tenue">
              Uscire non chiude la partita
            </span>
          </div>
        )}

        {/* Largo quanto serve e non di piu': su un monitor da lavoro un
            tabellone a tutta pagina allontana i due punteggi di mezzo metro
            l'uno dall'altro, e il confronto fra i due numeri e' esattamente
            la cosa per cui lo si guarda. */}
        <Pannello alto className="mx-auto max-w-[54rem] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5 sm:px-4">
            <div className="min-w-0 text-center">
              <div className="flex items-center justify-center gap-1.5">
                {/* Chi ha il servizio, detto come lo direbbe un tabellone: un
                    pallino acceso accanto al nome. Guardando il punteggio si
                    vede anche di chi e' la battuta, senza un secondo sguardo. */}
                {scambi && scambi.serve === 'us' && (
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-verde shadow-blu" aria-label="al servizio" />
                )}
                <span className="truncate text-[11px] font-bold uppercase tracking-etichetta text-tenue">
                  {(state.teamProfile || {}).name}
                </span>
              </div>
              <div className="mt-1 text-[clamp(30px,9vw,46px)] font-bold leading-none text-verde">
                {grandeNostro}
              </div>
              <ManoPunteggio
                attiva={manoNostra}
                onPiu={(n) => manoPunteggio('us', n)}
                onMeno={() => manoPunteggio('us', -1)}
              />
            </div>

            {/* La zona centrale: che periodo si sta giocando, e tutto il
                contorno. Qui sta anche il conto dei set vinti — piccolo,
                perche' e' il riassunto, non il gioco. */}
            <div className="px-1 text-center sm:px-2">
              <div className="text-[12px] font-bold uppercase tracking-etichetta text-tenue">
                {conf.period.short}{g.quarter}
              </div>
              {perSet && (
                <div className="mt-1.5 rounded-full bg-pannello/14 px-2.5 py-0.5 text-[12px] font-bold leading-none text-soffuso">
                  <span className="cifra">{g.teamScore}–{g.oppScore}</span>
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-etichetta text-tenue">set</span>
                </div>
              )}
              {g.friendly && (
                <div className="mt-1.5 rounded-full bg-pannello/14 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-etichetta text-tenue">
                  amichevole
                </div>
              )}
              {conf.teamFouls && (
                <div className={cx('mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  bonus ? 'bg-rosso/18 text-rosso' : 'bg-pannello/12 text-tenue')}>
                  {falli} falli{bonus ? ' · bonus' : ''}
                </div>
              )}
            </div>

            <div className="min-w-0 text-center">
              <div className="flex items-center justify-center gap-1.5">
                {scambi && scambi.serve === 'them' && (
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-ambra" aria-label="al servizio" />
                )}
                <span className="truncate text-[11px] font-bold uppercase tracking-etichetta text-tenue">
                  {g.oppName}
                </span>
              </div>
              <div className="mt-1 text-[clamp(30px,9vw,46px)] font-bold leading-none">
                {grandeLoro}
              </div>
              <ManoPunteggio
                attiva={manoLoro}
                valori={conf.manoPunti || [1]}
                onPiu={(n) => manoPunteggio('them', n)}
                onMeno={() => manoPunteggio('them', -1)}
              />
            </div>
          </div>

          {/* LA DOMANDA DI INIZIO SET.
              Una sola, e poi mai piu': da li' in avanti chi vince lo scambio
              serve il successivo, e l'app se lo tiene da sola. Non blocca
              niente — si puo' segnare lo stesso e rispondere dopo, perdendo
              solo i conti delle fasi di quel set. */}
          {scambi && !scambi.serve && !(avviso && avviso.chiusa) && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-bordo/10 bg-blu/8 px-3 py-2">
              <span className="text-[12.5px] font-semibold text-soffuso">
                {conf.scambi.domanda}
              </span>
              <button
                onClick={() => iniziaServizio('us')}
                className="rounded-lg bg-verde/16 px-3 py-1.5 text-[12.5px] font-bold text-verde ring-1 ring-verde/30 transition-all hover:bg-verde/24 active:scale-95"
              >
                {conf.scambi.noi}
              </button>
              <button
                onClick={() => iniziaServizio('them')}
                className="rounded-lg bg-ambra/16 px-3 py-1.5 text-[12.5px] font-bold text-ambra ring-1 ring-ambra/30 transition-all hover:bg-ambra/24 active:scale-95"
              >
                {conf.scambi.loro}
              </button>
            </div>
          )}

          {/* LE DUE FASI, DAL VIVO.
              Cambio palla e break sono i due numeri che in panchina si
              chiedono ad alta voce, e finora non li avevamo affatto. Compaiono
              appena c'e' qualcosa da dire: prima del primo scambio sarebbero
              due trattini che occupano una riga. */}
          {scambi && (scambi.so.t > 0 || scambi.bp.t > 0) && (
            <div className="flex items-center justify-center gap-5 border-t border-bordo/10 px-3 py-1.5">
              {scambi.so.t > 0 && (
                <span className="text-[11.5px] text-tenue">
                  {conf.scambi.etichettaCambioPalla}{' '}
                  <b className="cifra text-[13px] text-testo">{pct(scambi.so)}%</b>
                  <span className="cifra ml-1">({scambi.so.v}/{scambi.so.t})</span>
                </span>
              )}
              {scambi.bp.t > 0 && (
                <span className="text-[11.5px] text-tenue">
                  {conf.scambi.etichettaBreak}{' '}
                  <b className="cifra text-[13px] text-testo">{pct(scambi.bp)}%</b>
                  <span className="cifra ml-1">({scambi.bp.v}/{scambi.bp.t})</span>
                </span>
              )}
            </div>
          )}

          {/* Il regolamento che parla. Ambra quando manca un punto alla fine,
              verde quando il set e' finito davvero: due stati, due colori, e
              non serve leggere per sapere quale dei due e'. */}
          {avviso && (
            <div className={cx(
              'border-t px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-etichetta',
              avviso.finito ? 'border-verde/20 bg-verde/10 text-verde' : 'border-ambra/20 bg-ambra/10 text-ambra'
            )}>
              {avviso.testo}
            </div>
          )}

          {/* I parziali chiusi, in fondo e in mezzo. Non c'e' riga finche' non
              si chiude il primo periodo: uno spazio vuoto che aspetta e' peggio
              di nessuno spazio. */}
          {parziali && (
            <div className="border-t border-bordo/10 px-3 py-1.5 text-center">
              <span className="cifra text-[11px] font-semibold text-tenue">{parziali}</span>
            </div>
          )}

          <div className="flex gap-px border-t border-bordo/10 bg-bordo/10">
            <button
              onClick={annulla}
              disabled={state.undoStack.length === 0}
              className="min-w-0 flex-1 bg-fondo/40 px-2 py-2.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo disabled:opacity-35"
            >
              <span className="block truncate">
                ↺ Annulla{daAnnullare ? <span className="text-tenue"> · {daAnnullare}</span> : null}
              </span>
            </button>
            {!(avviso && avviso.chiusa) && (
              <button
                onClick={() => setChiudiPeriodo(true)}
                className={cx(
                  'flex-1 py-2.5 text-[13px] transition-colors',
                  avviso && avviso.finito
                    ? 'bg-verde/14 font-bold text-verde hover:brightness-110'
                    : 'bg-fondo/40 font-semibold text-soffuso hover:text-testo'
                )}
              >
                Chiudi {conf.period.label.toLowerCase()}
              </button>
            )}
            <button
              onClick={() => setFinePartita(true)}
              className={cx(
                'flex-1 py-2.5 text-[13px] transition-all',
                avviso && avviso.chiusa
                  ? 'bg-ambra/16 font-bold text-ambra hover:brightness-110'
                  : 'bg-fondo/40 font-semibold text-ambra hover:brightness-125'
              )}
            >
              Fine partita
            </button>
          </div>
        </Pannello>
      </div>

      {/* ============================================== campo e panchina */}
      {/* Affiancati da tablet in su: è lì che si segna quasi sempre, e due
          colonne tolgono lo scorrimento proprio mentre il gioco corre. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_14rem] md:items-start md:gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">

        <div className="campo-cornice" style={{ '--proporzione': sport.field.ratio }}>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <Etichetta>{sport.field.onFieldLabel} · tocca per assegnare</Etichetta>
            {conf.rotazione ? (
              <div className="flex shrink-0 items-center gap-2">
                {scambi && (
                  <span className="rounded-lg bg-pannello/12 px-2 py-1 text-[11.5px] font-bold text-soffuso">
                    R{scambi.rot}
                  </span>
                )}
              <button
                onClick={ruota}
                title={conf.rotazione.descrizione}
                className="flex shrink-0 items-center gap-1.5 rounded-lg vetro orlo px-2.5 py-1.5 text-[12.5px] font-semibold text-soffuso transition-all hover:text-testo active:scale-95"
              >
                <svg viewBox="0 0 20 20" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16.5 8.5a6.5 6.5 0 1 0-.7 5" /><path d="M16.8 3.5v5h-5" />
                </svg>
                {conf.rotazione.etichetta}
              </button>
              </div>
            ) : (
              <span className="text-[12.5px] text-tenue">{inCampo.length} di {sport.match.minOnField}</span>
            )}
          </div>

          <Pannello alto className="overflow-hidden">
            <div className="campo parquet relative w-full">
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
                <div className="text-[15px] font-bold leading-none">{sigla(p)}</div>
                <div className="mt-1 truncate text-[11px] text-tenue">{p.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>

          {sostituzione && (
            <button
              onClick={() => setSostituzione(null)}
              className="mt-3 w-full rounded-lg vetro orlo py-2 text-[13px] font-semibold text-tenue hover:text-testo"
            >
              Annulla la sostituzione
            </button>
          )}

          {/* Tre righe, non un foglietto di istruzioni: durante una partita
              nessuno legge, e quello che resta a schermo va guadagnato. */}
          <ul className="mt-4 space-y-1.5 text-[12.5px] leading-relaxed text-tenue">
            <li>Tocca un giocatore, poi l’azione.</li>
            <li>Le domande che seguono (rimbalzo, assist) si saltano toccando fuori.</li>
            <li>Il ⇄ sul gettone prepara una sostituzione.</li>
            <li>I punti senza autore si mettono col + e col − sotto al punteggio.</li>
          </ul>
        </div>
      </div>

      {/* ======================================================= la mappa */}
      {tiroDaPiazzare && (
        <MappaTiro
          sport={sport}
          tiro={tiroDaPiazzare}
          onPunto={(punto) => {
            const { giocatore, azione } = tiroDaPiazzare;
            setTiroDaPiazzare(null);
            esegui(giocatore, azione, false, punto);
          }}
          onChiudi={() => setTiroDaPiazzare(null)}
        />
      )}

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
          dettaglio={dettaglio}
          onDettaglio={() => setDettaglio(v => { ricordaDettaglio(!v); return !v; })}
          onAzione={(a) => {
            // Con la mappa accesa un tiro non si registra subito: prima si
            // dice da dove. Il pannello si chiude perche' il campo dev'essere
            // libero — e' la cosa che si sta per toccare.
            if (conf.mappaTiri && mappa && a.zona) {
              setTiroDaPiazzare({ giocatore: giocatoreScelto, azione: a });
              setScelto(null);
              setAncora(null);
              return;
            }
            esegui(giocatoreScelto, a);
          }}
          mappa={mappa}
          onMappa={() => setMappa(v => { ricordaMappa(!v); return !v; })}
          onChiudi={() => { setScelto(null); setAncora(null); }}
        />
      )}

      {chiudiPeriodo && (
        <ChiusuraPeriodo
          g={g}
          sport={sport}
          onChiudi={() => setChiudiPeriodo(false)}
          onFatto={(msg) => {
            // Qui il punteggio avversario e' appena stato corretto sul
            // tabellone della palestra: il turno si chiude su quel numero,
            // che e' l'unico vero. Poi se ne apre uno nuovo per il periodo
            // che comincia.
            chiudiTurno();
            apriTurno();
            aggiorna(); salva(); avvisa(msg);
          }}
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
            // L'ultimo turno si chiude qui: senza, i cinque che hanno giocato
            // il finale sarebbero gli unici a non avere un piu'/meno.
            chiudiTurno();
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
            cancellaCopia(g.sectorId);
            state.liveGame = null;
            state.undoStack = [];
            state.undoTesti = [];
            onFinita();
          }}
        />
      )}
    </div>
  );

  if (!onEsci) return corpo;

  // LO SCOUT E' UNA SCHERMATA A SE'.
  //
  // Mentre si segna una partita non serve nient'altro: non la barra delle
  // sezioni, non il menu, non il nome della societa'. Ogni cosa che resta sullo
  // schermo e' una cosa che si puo' toccare per sbaglio mentre il gioco corre,
  // e su un tablet tenuto con due mani gli sbagli si fanno ai bordi.
  //
  // Fuori dall'impaginazione dell'app, quindi: la finestra e' tutta della
  // partita, e si esce da un pulsante solo.
  return createPortal(
    <div className="scout-schermo fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-fondo">
      <div className="mx-auto w-full max-w-[68rem] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pt-3">
        {corpo}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------- mano sul punteggio */
// Sotto il numero grande, non accanto a un secondo numero: il punteggio e'
// uno, e questi sono i due gesti che lo muovono. Verde aggiunge, rosso toglie
// — si distinguono senza leggere, che e' l'unico modo di usarli mentre si
// guarda il campo.
//
// Dove i punti appartengono sempre a un giocatore (i nostri, nel basket) la
// mano non c'e': lo spazio pero' resta, cosi' i due numeri grandi restano
// sulla stessa riga invece di sfalsarsi.
/* I punti che segna l'avversario.
 *
 * C'era un solo pulsante, «+1». Nella pallavolo e' giusto — un punto e' un
 * punto — ma nel basket una tripla avversaria voleva TRE tocchi, e il
 * segnapunti li faceva mentre il gioco era gia' ripartito. Tre tocchi per un
 * evento solo sono anche tre occasioni di perderne uno.
 *
 * Adesso i valori li dichiara lo sport. E non e' una comodita': senza un
 * punteggio avversario che si muove in tempo reale e giusto, il piu'/meno dei
 * quintetti non esisterebbe, perche' non si saprebbe mai quanti punti ha
 * preso un quintetto mentre era in campo.
 */
function ManoPunteggio({ attiva, valori = [1], onPiu, onMeno }) {
  if (!attiva) return <div className="mt-2 h-8" aria-hidden="true" />;
  const largo = valori.length > 1;
  return (
    <div className={cx('mt-2 flex items-center justify-center', largo ? 'gap-1.5' : 'gap-2')}>
      <button
        onClick={onMeno}
        aria-label="Togli un punto"
        className={cx(
          'grid h-8 shrink-0 place-items-center rounded-lg bg-rosso/16 text-[16px] font-bold leading-none',
          'text-rosso ring-1 ring-rosso/35 transition-all hover:bg-rosso/26 active:scale-95',
          largo ? 'w-9' : 'w-11'
        )}
      >
        −
      </button>
      {valori.map(n => (
        <button
          key={n}
          onClick={() => onPiu(n)}
          aria-label={'Aggiungi ' + n + (n === 1 ? ' punto' : ' punti')}
          className={cx(
            'grid h-8 shrink-0 place-items-center rounded-lg bg-verde/18 text-[15px] font-bold leading-none',
            'text-verde ring-1 ring-verde/35 transition-all hover:bg-verde/28 active:scale-95',
            largo ? 'w-9' : 'w-11'
          )}
        >
          +{largo ? n : ''}
        </button>
      ))}
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
          {sigla(p)}
        </button>

        <button
          onClick={onSostituisci}
          title="Prepara la sostituzione"
          className={cx(
            'absolute -right-0.5 -top-0.5 grid place-items-center rounded-full font-bold transition-all',
            inSostituzione
              ? 'vivo text-white'
              : 'su-legno text-white/80 ring-1 ring-white/40 hover:text-white'
          )}
          style={{ width: 'var(--scambio)', height: 'var(--scambio)', fontSize: 'calc(var(--scambio) * 0.52)' }}
        >
          ⇄
        </button>

        {/* Il riscontro dell'ultima azione, sopra il gettone di chi l'ha fatta. */}
        {lampo && (
          <span className="pointer-events-none absolute inset-x-0 -top-3 flex justify-center">
            <span className="animate-salita whitespace-nowrap rounded-full vivo px-2 py-0.5 text-[11px] font-bold text-white">
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

/* ------------------------------------------------------------- la mappa */
/* DA DOVE HA TIRATO.
 *
 * Il campo, grande, e un tocco. Niente elenco di zone da scegliere: la zona
 * si deduce dal punto, e chiedere una cosa che l'app puo' dedurre e' il modo
 * piu' rapido di far perdere l'azione dopo a chi segna.
 *
 * C'e' una via d'uscita, «Non l'ho visto»: il tiro si registra lo stesso,
 * senza posizione. Un tiro perso vale molto meno di un tiro messo a caso, e
 * senza quella scorciatoia qualcuno un punto a caso lo tocca — e da quel
 * momento la mappa mente invece di mancare.
 */
function MappaTiro({ sport, tiro, onPunto, onChiudi }) {
  const campo = useRef(null);

  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [onChiudi]);

  function tocca(e) {
    const r = campo.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    // Un tocco sul bordo esatto non deve produrre un 100,4%: il campo finisce
    // dove finisce.
    onPunto({
      x: Math.round(Math.min(100, Math.max(0, x)) * 10) / 10,
      y: Math.round(Math.min(100, Math.max(0, y)) * 10) / 10
    });
    if (navigator.vibrate) navigator.vibrate(8);
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col justify-end" onMouseDown={onChiudi}>
      <div className="absolute inset-0 bg-fondo/80 backdrop-blur-sm" />
      <div
        onMouseDown={e => e.stopPropagation()}
        className="relative max-h-[92dvh] overflow-y-auto rounded-t-2xl vetro-alto border-t border-bordo/12 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-lg animate-salita sm:px-6"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-pannello/25" />

        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg vivo text-[14px] font-bold text-white">
            {sigla(tiro.giocatore)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold leading-tight">Da dove ha tirato?</div>
            <div className="truncate text-[12.5px] text-tenue">
              {tiro.giocatore.name} · {tiro.azione.etichettaBreve || tiro.azione.label}
            </div>
          </div>
          <button
            onClick={() => onPunto(null)}
            className="shrink-0 rounded-lg vetro orlo px-3 py-2 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
          >
            Non l’ho visto
          </button>
        </div>

        <div className="campo-cornice" style={{ '--proporzione': sport.field.ratio }}>
          <div
            ref={campo}
            onClick={tocca}
            className="campo parquet relative w-full cursor-crosshair"
          >
            <RigheCampo svg={sport.field.svg} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
            className="shrink-0 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-tenue hover:text-testo"
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
              <div className="mt-1 truncate text-[11px] text-tenue">{p.name.split(' ')[0]}</div>
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
function PannelloAzioni({ p, conf, ancora, dettaglio, onDettaglio, mappa, onMappa, onAzione, onChiudi }) {
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
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg vivo text-[16px] font-bold text-white">
          {sigla(p)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">{p.name}</div>
          <div className="text-[12.5px] text-tenue">{p.onCourt ? 'in campo' : 'in panchina'}</div>
        </div>
        <button
          onClick={onChiudi}
          className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold text-tenue hover:text-testo"
        >
          Chiudi
        </button>
      </div>

      {/* Nel pannello ancorato i gruppi stanno su due colonne: con diciotto
          azioni in colonna unica il pannello diventa piu' alto dello schermo e
          copre il campo, che e' la cosa che si stava guardando. */}
      <div className={cx(largo ? 'grid grid-cols-2 gap-x-3 gap-y-3' : 'space-y-3')}>
        {conf.groups.filter(gr => !gr.dettaglio || dettaglio).map(gr => (
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

      {/* L'interruttore sta qui, sotto ai pulsanti: e' guardandoli che viene da
          chiedersi se ce ne sono altri, non in una schermata di impostazioni. */}
      {conf.groups.some(gr => gr.dettaglio) && (
        <button
          onClick={onDettaglio}
          className="mt-3.5 w-full rounded-lg py-2 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
        >
          {dettaglio ? 'Nascondi ricezione e servizio' : 'Segna anche ricezione e servizio'}
        </button>
      )}

      {conf.mappaTiri && (
        <button
          onClick={onMappa}
          className="mt-3.5 w-full rounded-lg py-2 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
        >
          {mappa
            ? 'Non chiedere più da dove ha tirato'
            : 'Chiedi da dove ha tirato (un tocco in più)'}
        </button>
      )}
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

  // Con un regolamento alle spalle il pulsante puo' dire cosa succede DOPO,
  // mentre si scrive: se questi numeri chiudono la partita, si legge prima di
  // premere invece di scoprirlo dopo.
  const nLoro = parseInt(loro, 10);
  const conQuesti = isNaN(nLoro)
    ? (g.periodScores || []).slice(0, idx)
    : [...(g.periodScores || []).slice(0, idx), { us: nostriOra, them: nLoro }];
  const esito = partitaDecisa(conf, conQuesti);
  const chiudeLaPartita = !!(esito && esito.finita);
  const massimi = periodiMassimi(conf);
  const seti = conf.period.label.toLowerCase();

  return (
    <Modulo
      titolo={`Chiudi ${conf.period.label.toLowerCase()} ${g.quarter}`}
      sotto={conf.periodPrompt}
      etichettaInvia={
        chiudeLaPartita
          ? 'Salva: la partita finisce qui'
          : (ultimo && !conf.period.allowExtra ? 'Salva' : `Vai al ${seti} ${g.quarter + 1}`)
      }
      onChiudi={onChiudi}
      onInvia={async () => {
        if (loro === '') return 'Scrivi quanti punti ha segnato l’avversario.';
        const n = parseInt(loro, 10);
        if (isNaN(n) || n < 0) return 'Il punteggio non può essere negativo.';

        // Il regolamento come rete. Un punteggio impossibile non e' un
        // capriccio dell'app: vuol dire che un punto non e' stato segnato, e
        // questo e' l'ultimo momento in cui ce ne si accorge guardando ancora
        // il tabellone della palestra.
        const impossibile = perchePunteggioImpossibile(conf, g.quarter, nostriOra, n, conf.period.label);
        if (impossibile) return impossibile + ' Confronta col tabellone e correggi i punti prima di chiudere.';

        g.periodScores = g.periodScores || [];
        // Si scrivono i due numeri e basta: chi batteva, la rotazione e i conti
        // delle fasi restano dov'erano, perche' sono la storia di quel set.
        g.periodScores[idx] = { ...(g.periodScores[idx] || {}), us: nostriOra, them: n };
        g.chiusi = Math.max(g.chiusi || 0, idx + 1);

        const deciso = partitaDecisa(conf, g.periodScores.slice(0, idx + 1));
        // Non si apre un set che non si giochera' mai: ne' il sesto, ne' quello
        // dopo una partita gia' vinta.
        const altroPeriodo = (!deciso || !deciso.finita)
          && (massimi ? g.quarter < massimi : (g.quarter < g.numQuarters || conf.period.allowExtra));

        if (altroPeriodo) {
          g.quarter += 1;
          if (g.quarter > g.numQuarters) g.numQuarters = g.quarter;
          if (conf.teamFouls) g.quarterFouls[g.quarter] = 0;
        }

        onFatto(deciso && deciso.finita
          ? `Partita finita ${deciso.us}–${deciso.them}: chiudila dal tabellone`
          : `${conf.period.label} ${idx + 1} chiuso`);
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

      <p className="text-[12.5px] leading-relaxed text-tenue">
        Confronta «noi» con il tabellone della palestra: se non coincidono è sfuggito un canestro,
        ed è adesso il momento di accorgersene. Puoi correggerlo annullando le ultime azioni.
      </p>

      {/* Il regolamento detto una volta, dove serve: qui i numeri si scrivono,
          e qui vengono controllati. */}
      {conf.regolamento && (
        <p className="rounded-lg bg-pannello/8 px-3.5 py-3 text-[12.5px] leading-relaxed text-soffuso">
          Questo {seti} si chiude a <b>{conf.regolamento.sogliaPeriodo(g.quarter)} punti</b> con
          almeno {conf.regolamento.scarto} di scarto. Partita a{' '}
          {conf.regolamento.periodiPerVincere} {seti} vinti
          {esito ? <> · ora {esito.us}–{esito.them}</> : null}.
        </p>
      )}

      {ultimo && conf.period.allowExtra && !chiudeLaPartita && (
        <p className="rounded-lg bg-pannello/8 px-3.5 py-3 text-[13px] leading-relaxed text-soffuso">
          Era l’ultimo {conf.period.label.toLowerCase()} previsto. Se la partita è in parità,
          continuando si apre un {conf.period.extraLabel.toLowerCase()}; altrimenti chiudi la
          partita dal tabellone.
        </p>
      )}
    </Modulo>
  );
}
