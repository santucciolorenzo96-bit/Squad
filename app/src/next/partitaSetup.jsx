import React, { useState } from 'react';
import { state } from '../state.js';
import { startGame } from '../api/games.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Avatar, Stato, cx } from './ui.jsx';
import { Campo, Testo, Scelta, useAvviso } from './moduli.jsx';

/* L'avvio di una partita.
 *
 * Tre decisioni in una schermata sola — chi affrontiamo, quanti periodi, chi
 * comincia — e nessuna di esse dietro un passo successivo: a bordo campo si
 * apre l'app cinque minuti prima della palla a due, e ogni schermata in più è
 * una schermata in cui si può restare bloccati.
 *
 * L'avversario arriva già scritto se oggi c'è una partita in calendario: è il
 * caso normale, e digitare un nome mentre la squadra si riscalda no.
 */

const oggiISO = () => new Date().toISOString().slice(0, 10);

export function AvvioPartita({ onAvviata }) {
  const sport = currentSport();
  const conf = sport.scout;
  const inCampo = sport.match.minOnField;
  const avvisa = useAvviso();

  // Le partite di oggi e domani della categoria: quasi sempre è una di queste.
  const oggi = oggiISO();
  const domani = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const candidate = state.calendar
    .filter(m => !m.played && (m.date === oggi || m.date === domani))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const [scelta, setScelta] = useState(candidate.length ? candidate[0].id : '');
  const [avversario, setAvversario] = useState(candidate.length ? candidate[0].opponent : '');
  const [periodi, setPeriodi] = useState(String(conf.period.count));
  const [titolari, setTitolari] = useState([]);
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  function scegliPartita(id) {
    setScelta(id);
    const m = candidate.find(x => x.id === id);
    if (m) setAvversario(m.opponent);
  }

  function alterna(id) {
    setTitolari(t => {
      if (t.includes(id)) return t.filter(x => x !== id);
      if (t.length >= inCampo) return t;   // oltre il quintetto non si aggiunge
      return [...t, id];
    });
  }

  async function avvia() {
    setErrore('');
    if (titolari.length !== inCampo) {
      setErrore(`Scegli esattamente ${inCampo} giocatori (adesso ne hai ${titolari.length}).`);
      return;
    }
    setLavora(true);
    try {
      const nQ = Math.max(1, Math.min(parseInt(periodi, 10) || conf.period.count, 9));
      const bozza = {
        oppName: avversario.trim() || 'Avversari',
        quarterLength: 0,
        numQuarters: nQ,
        quarter: 1,
        clock: 0,
        clockRunning: false,
        teamScore: 0,
        oppScore: 0,
        players: state.roster.map(p => ({
          id: p.id, number: p.number, name: p.name,
          onCourt: titolari.includes(p.id), stats: sport.newStats()
        })),
        quarterFouls: conf.teamFouls ? { 1: 0 } : {},
        periodScores: [],
        calendarMatchId: scelta || null
      };
      // Con i dati d'esempio non c'e' nessun database a cui chiedere un id:
      // la partita vive solo in memoria. Serve a poter guardare lo scout senza
      // una sessione, che e' il motivo per cui l'anteprima esiste.
      const creata = inCampione()
        ? { ...bozza, id: 'demo-' + Date.now() }
        : await startGame(state.teamProfile.id, state.activeSectorId, bozza, state.currentUser.id);
      state.liveGame = creata;
      state.undoStack = [];
      onAvviata();
    } catch (e) {
      console.error(e);
      setErrore((e && e.message) || 'Non è stato possibile avviare la partita.');
    } finally {
      setLavora(false);
    }
  }

  if (state.roster.length < inCampo) {
    return (
      <div className="sezioni">
        <Titolo sopra="Categoria">Partita</Titolo>
        <Vuoto>
          Servono almeno {inCampo} giocatori in rosa per aprire un tabellino, e adesso
          ce ne sono {state.roster.length}. Si aggiungono dall’Anagrafica.
        </Vuoto>
      </div>
    );
  }

  return (
    <div className="sezioni">
      <Titolo sopra="Categoria">Nuova partita</Titolo>

      {/* ------------------------------------------------- chi affrontiamo */}
      <Pannello className="pad-pannello-stretto">
        <Etichetta>Contro chi</Etichetta>

        {candidate.length > 0 && (
          <div className="mt-3 space-y-2">
            {candidate.map(m => (
              <button
                key={m.id}
                onClick={() => scegliPartita(m.id)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-all orlo',
                  scelta === m.id ? 'vetro-alto ring-1 ring-blu' : 'vetro hover:bg-pannello/12'
                )}
              >
                <span className={cx(
                  'shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-etichetta',
                  m.home === false ? 'bg-pannello/14 text-tenue' : 'bg-blu/16 text-blu'
                )}>
                  {m.home === false ? 'fuori' : 'casa'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{m.opponent}</span>
                <span className="shrink-0 text-[12px] text-tenue">
                  {m.date === oggi ? 'oggi' : 'domani'}{m.time ? ' · ' + m.time : ''}
                </span>
              </button>
            ))}
            <button
              onClick={() => { setScelta(''); setAvversario(''); }}
              className={cx(
                'w-full rounded-lg px-3.5 py-2.5 text-[12.5px] font-semibold transition-all orlo',
                scelta === '' ? 'vetro-alto ring-1 ring-blu' : 'vetro text-tenue hover:text-testo'
              )}
            >
              Un’altra partita
            </button>
          </div>
        )}

        {(candidate.length === 0 || scelta === '') && (
          <div className="mt-3">
            <Campo etichetta="Nome dell’avversario">
              <Testo
                value={avversario}
                onChange={e => setAvversario(e.target.value)}
                placeholder="Virtus Forlimpopoli"
              />
            </Campo>
          </div>
        )}

        {scelta && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
            A fine partita il risultato torna da solo su questa riga di calendario e in classifica:
            non va riscritto a mano.
          </p>
        )}
      </Pannello>

      {/* ----------------------------------------------------- i periodi */}
      <Pannello className="pad-pannello-stretto">
        <Etichetta>Quanti {conf.period.label.toLowerCase()}</Etichetta>
        <div className="mt-3 flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => setPeriodi(String(n))}
              className={cx(
                'h-11 w-11 rounded-lg text-[15px] font-bold transition-all orlo',
                periodi === String(n)
                  ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
                  : 'vetro text-soffuso hover:text-testo'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
          Niente cronometro: nel basket si ferma troppo spesso perché inseguirlo valga la pena,
          e i minuti in campo si contano male più che non contarli.
          {conf.period.allowExtra && ' I supplementari si aggiungono in corsa, quando servono.'}
        </p>
      </Pannello>

      {/* -------------------------------------------------- chi comincia */}
      <Pannello className="pad-pannello-stretto">
        <div className="flex items-center justify-between gap-3">
          <Etichetta>Chi comincia</Etichetta>
          <span className={cx('text-[12.5px] font-bold',
            titolari.length === inCampo ? 'text-verde' : 'text-ambra')}>
            {titolari.length} di {inCampo}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.roster.map(p => {
            const on = titolari.includes(p.id);
            const pieno = !on && titolari.length >= inCampo;
            return (
              <button
                key={p.id}
                onClick={() => alterna(p.id)}
                disabled={pieno}
                className={cx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all orlo',
                  on ? 'vetro-alto ring-1 ring-blu' : 'vetro',
                  pieno && 'opacity-35'
                )}
              >
                <span className="w-6 shrink-0 text-right text-[13px] font-medium text-tenue">{p.number}</span>
                <Avatar nome={p.name} dim={28} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{p.name}</span>
              </button>
            );
          })}
        </div>
      </Pannello>

      {errore && (
        <div className="rounded-lg bg-rosso/12 px-4 py-3 text-[13px] text-rosso">{errore}</div>
      )}

      <Pulsante
        variante="primario"
        onClick={avvia}
        disabled={lavora}
        className="w-full py-4 text-[15px] font-bold"
      >
        {lavora ? 'Avvio…' : `Palla a due contro ${avversario.trim() || 'Avversari'}`}
      </Pulsante>
    </div>
  );
}
