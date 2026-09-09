import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { removePlayerFromSector, fetchPlayerPhotoUrls } from '../api/roster.js';
import { canEditRoster, canEditHome, isLinkedUser } from '../utils/permissions.js';
import { computeSeasonStats, findSeasonRow } from '../utils/stats.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Avatar, cx } from './ui.jsx';
import { Conferma, Finestra, useAvviso } from './moduli.jsx';

/* La rosa.
 *
 * Due cose in una schermata, ed è voluto: sopra la formazione sul campo, sotto
 * l'elenco. La formazione è il motivo per cui un allenatore apre questa pagina;
 * l'elenco è il modo di sapere chi c'è.
 *
 * Il campo NON è una decorazione. Le posizioni dei cinque non dipendono dal
 * ruolo scritto in anagrafica — che spesso manca o è generico — ma da cinque
 * posti fissi definiti dallo sport: è il modo in cui un allenatore disegna una
 * formazione su una lavagna.
 *
 * Aggiungere un giocatore non si fa più da qui: si fa dall'Anagrafica, che è
 * dove stanno i suoi dati. Qui si compone chi gioca, non si crea chi esiste.
 */

function iniziali(nome) {
  return (nome || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Le tre medie sul gettone: quali siano lo decide lo sport.
function medie(riga, sport) {
  if (!riga || !riga.games) return sport.headline.map(h => ({ short: h.short, v: '—' }));
  return sport.headline.map(h => ({
    short: h.short,
    v: ((riga[h.key] || 0) / riga.games).toFixed(1)
  }));
}

// Formazione di partenza: chi era in campo nell'ultima partita, rimappato sulla
// rosa di adesso per id (o per numero, se l'id non c'è più). Senza storico, i
// primi della rosa.
function quintettoIniziale(inCampo) {
  const ultima = state.history[state.history.length - 1];
  const ids = [];
  if (ultima) {
    (ultima.players || []).filter(p => p.onCourt).forEach(snap => {
      const trovato = state.roster.find(p => p.id === snap.id)
        || state.roster.find(p => p.number === snap.number);
      if (trovato && !ids.includes(trovato.id)) ids.push(trovato.id);
    });
  }
  for (const p of state.roster) {
    if (ids.length >= inCampo) break;
    if (!ids.includes(p.id)) ids.push(p.id);
  }
  return ids.slice(0, inCampo);
}

/* ------------------------------------------------------------------ gettone */
function Gettone({ p, foto, sport, riga, armato, sulCampo, onApri, onScambia, stile }) {
  return (
    <div
      style={stile}
      className={cx(
        'group flex w-[5.6rem] flex-col items-center sm:w-[6.4rem]',
        sulCampo && 'absolute -translate-x-1/2 -translate-y-1/2'
      )}
    >
      {/* Le medie sopra la testa, minuscole: servono a scegliere chi mettere in
          campo, e su un gettone non c'è posto per una tabella. */}
      <div className="mb-1 flex gap-1.5">
        {medie(riga, sport).map(m => (
          <span key={m.short} className="rounded-full bg-fondo/55 px-1.5 py-0.5 text-center leading-none backdrop-blur-sm">
            <i className="block text-[7.5px] font-bold uppercase not-italic tracking-etichetta text-white/60">{m.short}</i>
            <b className="block text-[10px] font-bold text-white">{m.v}</b>
          </span>
        ))}
      </div>

      <div className="relative">
        <button onClick={onApri} title={p.name} className="block">
          <span className={cx(
            'block rounded-full ring-2 transition-all',
            armato ? 'ring-blu shadow-blu' : 'ring-white/70'
          )}>
            {foto ? (
              <img src={foto} alt="" className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-fondo/70 text-[14px] font-bold text-white backdrop-blur-sm sm:h-14 sm:w-14">
                {iniziali(p.name)}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onScambia(); }}
          title="Prepara la sostituzione"
          aria-label={'Sostituisci ' + p.name}
          className={cx(
            'absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full',
            'text-[11px] font-bold transition-all',
            armato
              ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              : 'bg-fondo/80 text-white/80 backdrop-blur-sm hover:text-white'
          )}
        >
          ⇄
        </button>
      </div>

      <div className="mt-1.5 w-full truncate text-center text-[11px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.8)]">
        {p.name}
      </div>
      <div className="text-[10px] font-bold text-white/65">#{p.number}</div>
    </div>
  );
}

/* --------------------------------------------------------------------- Rosa */
export function Rosa() {
  const sport = currentSport();
  const inCampo = sport.match.minOnField;

  const [foto, setFoto] = useState({});
  const [caricato, setCaricato] = useState(false);
  const [quintetto, setQuintetto] = useState(() => quintettoIniziale(inCampo));
  const [armatoCampo, setArmatoCampo] = useState(null);
  const [armatoPanca, setArmatoPanca] = useState(null);
  const [scheda, setScheda] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditRoster(state.currentUser);
  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    setQuintetto(quintettoIniziale(inCampo));
    if (rosa.length === 0 || inCampione()) { setCaricato(true); return; }
    fetchPlayerPhotoUrls(rosa).catch(() => ({})).then(f => {
      if (vivo) { setFoto(f); setCaricato(true); }
    });
    return () => { vivo = false; };
  }, [rosa]);

  const stagione = computeSeasonStats(state.history, sport);
  const inCampoP = quintetto.map(id => rosa.find(p => p.id === id)).filter(Boolean);
  const inPanca = rosa.filter(p => !quintetto.includes(p.id));

  // Due tocchi, non un trascinamento: su un telefono in palestra il
  // trascinamento sbaglia bersaglio, e questa è una cosa che si fa in piedi
  // a bordo campo.
  function scambia(id) {
    const eraInCampo = quintetto.includes(id);
    if (eraInCampo) {
      if (armatoPanca) {
        setQuintetto(q => q.map(x => (x === id ? armatoPanca : x)));
        setArmatoPanca(null); setArmatoCampo(null);
      } else {
        setArmatoCampo(a => (a === id ? null : id));
        setArmatoPanca(null);
      }
    } else {
      if (armatoCampo) {
        setQuintetto(q => q.map(x => (x === armatoCampo ? id : x)));
        setArmatoCampo(null); setArmatoPanca(null);
      } else {
        setArmatoPanca(a => (a === id ? null : id));
        setArmatoCampo(null);
      }
    }
  }

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={<span className="shrink-0 text-[12.5px] text-tenue">{rosa.length} in rosa</span>}
      >
        Rosa
      </Titolo>

      {!caricato ? (
        <Scheletro righe={5} />
      ) : rosa.length === 0 ? (
        <Vuoto>
          Nessun giocatore in questa categoria. I giocatori si aggiungono dall’Anagrafica,
          che è dove stanno i loro dati.
        </Vuoto>
      ) : (
        <>
          {/* ------------------------------------------------------ il campo */}
          <Pannello alto className="mx-auto w-full max-w-[34rem] overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-bordo/10 px-5 py-3">
              <Etichetta>{sport.field.onFieldLabel}</Etichetta>
              <span className="text-[11.5px] text-tenue">{inCampoP.length} di {inCampo}</span>
            </div>

            <div className="parquet relative aspect-[15/14] w-full">
              <div className="righe-campo" dangerouslySetInnerHTML={{ __html: sport.field.svg }} />
              {inCampoP.map((p, i) => {
                const posto = sport.field.slots[i];
                return (
                  <Gettone
                    key={p.id}
                    p={p}
                    foto={foto[p.id]}
                    sport={sport}
                    riga={findSeasonRow(stagione, p)}
                    armato={armatoCampo === p.id}
                    sulCampo
                    stile={posto ? { top: posto.top, left: posto.left } : undefined}
                    onApri={() => setScheda(p)}
                    onScambia={() => scambia(p.id)}
                  />
                );
              })}
            </div>
          </Pannello>

          {/* ---------------------------------------------------- la panchina */}
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <Etichetta>{sport.field.benchLabel}</Etichetta>
              <span className="text-[11.5px] text-tenue">{inPanca.length}</span>
            </div>
            {inPanca.length === 0 ? (
              <Vuoto>Nessun giocatore in panchina.</Vuoto>
            ) : (
              <Pannello className="overflow-x-auto px-4 py-4">
                <div className="flex gap-4">
                  {inPanca.map(p => (
                    <Gettone
                      key={p.id}
                      p={p}
                      foto={foto[p.id]}
                      sport={sport}
                      riga={findSeasonRow(stagione, p)}
                      armato={armatoPanca === p.id}
                      onApri={() => setScheda(p)}
                      onScambia={() => scambia(p.id)}
                    />
                  ))}
                </div>
              </Pannello>
            )}
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
              Tocca <b className="text-soffuso">⇄</b> su un giocatore per prepararlo alla sostituzione,
              poi <b className="text-soffuso">⇄</b> sull’altro per scambiarli. Tocca il volto per le sue statistiche.
              {rosa.length < inCampo && ` Servono almeno ${inCampo} giocatori per comporre la formazione.`}
            </p>
          </div>

          {/* ------------------------------------------------------ l'elenco */}
          <div>
            <Etichetta className="mb-2.5">Tutti i giocatori</Etichetta>
            <Pannello className="overflow-hidden">
              {rosa.map((p, i) => (
                <div
                  key={p.id}
                  className={cx(
                    'flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-pannello/8 sm:px-5',
                    i > 0 && 'border-t border-bordo/6'
                  )}
                >
                  <span className="w-8 shrink-0 text-right text-[16px] font-medium text-tenue">{p.number}</span>
                  <Avatar nome={p.name} url={foto[p.id]} dim={36} />
                  <button onClick={() => setScheda(p)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[14px] font-semibold leading-tight">{p.name}</div>
                    {p.role_position && <div className="text-[11.5px] text-tenue">{p.role_position}</div>}
                  </button>
                  {quintetto.includes(p.id) && (
                    <span className="shrink-0 rounded-full bg-blu/16 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-etichetta text-blu">
                      in campo
                    </span>
                  )}
                  {puoiModificare && (
                    <button
                      onClick={() => setDaRimuovere(p)}
                      title="Togli dalla categoria"
                      className="shrink-0 rounded-lg px-2 py-2 text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </Pannello>
          </div>
        </>
      )}

      {scheda && (
        <SchedaGiocatore
          p={scheda}
          foto={foto[scheda.id]}
          riga={findSeasonRow(stagione, scheda)}
          sport={sport}
          onChiudi={() => setScheda(null)}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Togliere dalla categoria?"
          testo={`${daRimuovere.name} esce da questa categoria. La sua scheda, i documenti e lo storico restano: non viene cancellato niente.`}
          etichetta="Togli"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removePlayerFromSector(daRimuovere.id, state.activeSectorId, state.activeSeasonId);
            state.roster = state.roster.filter(x => x.id !== daRimuovere.id);
            // Chi esce dalla rosa non può restare in campo: il posto lasciato
            // libero lo prende il primo disponibile.
            setQuintetto(q => {
              const resto = q.filter(x => x !== daRimuovere.id);
              for (const p of state.roster) {
                if (resto.length >= inCampo) break;
                if (!resto.includes(p.id)) resto.push(p.id);
              }
              return resto;
            });
            ridisegna(n => n + 1);
            avvisa('Giocatore tolto dalla categoria');
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------- scheda giocatore */
function SchedaGiocatore({ p, foto, riga, sport, onChiudi }) {
  const puoiVedereEvolutiva = isLinkedUser(state.currentUser)
    ? state.linkedPlayers.some(lp => lp.id === p.id)
    : canEditHome(state.currentUser);

  return (
    <Finestra titolo={p.name} sotto={`#${p.number}${p.role_position ? ' · ' + p.role_position : ''}${p.height_cm ? ' · ' + p.height_cm + ' cm' : ''}`} onChiudi={onChiudi}>
      <div className="flex justify-center">
        <Avatar nome={p.name} url={foto} dim={92} />
      </div>

      {riga && riga.games ? (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {sport.headline.map(h => (
              <Pannello key={h.key} className="px-3 py-3 text-center">
                <div className="text-[24px] font-bold leading-none">
                  {((riga[h.key] || 0) / riga.games).toFixed(1)}
                </div>
                <Etichetta className="mt-2">{h.label}</Etichetta>
              </Pannello>
            ))}
          </div>
          <p className="mt-3 text-center text-[12px] text-tenue">
            medie su {riga.games} {riga.games === 1 ? 'partita giocata' : 'partite giocate'}
          </p>
        </>
      ) : (
        <p className="mt-6 text-center text-[13px] text-tenue">
          Nessuna statistica: non ha ancora giocato in questa stagione.
        </p>
      )}

      {puoiVedereEvolutiva && (
        <p className="mt-6 rounded-lg bg-pannello/8 px-3.5 py-3 text-[12px] leading-relaxed text-tenue">
          La scheda evolutiva — obiettivo e nota dell’allenatore — è ancora sull’app attuale:
          questa sezione non è stata rifatta.
        </p>
      )}
    </Finestra>
  );
}
