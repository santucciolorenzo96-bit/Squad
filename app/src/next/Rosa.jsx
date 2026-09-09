import React, { useEffect, useRef, useState } from 'react';
import { state } from '../state.js';
import { removePlayerFromSector, fetchPlayerPhotoUrls } from '../api/roster.js';
import { canEditRoster, canEditHome, isLinkedUser } from '../utils/permissions.js';
import { computeSeasonStats, findSeasonRow } from '../utils/stats.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Vuoto, Scheletro, Avatar, cx } from './ui.jsx';
import { Conferma, Finestra, useAvviso } from './moduli.jsx';

/* La rosa.
 *
 * Sopra la formazione sul campo, sotto l'elenco. La formazione è il motivo per
 * cui un allenatore apre questa pagina; l'elenco è il modo di sapere chi c'è.
 *
 * Il campo occupa tutta la larghezza disponibile e i giocatori crescono con
 * lui: le misure dei gettoni sono in `cqw`, cioè in percentuale della larghezza
 * DEL CAMPO, non della finestra. Con le unità di viewport sarebbero sbagliate
 * in tutti e due i casi, perché su desktop la colonna delle sezioni si mangia
 * 248px e su telefono sparisce.
 *
 * Le posizioni dei cinque non dipendono dal ruolo scritto in anagrafica — che
 * spesso manca o è generico — ma da cinque posti fissi definiti dallo sport:
 * è il modo in cui un allenatore disegna una formazione su una lavagna.
 */

function iniziali(nome) {
  return (nome || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function medie(riga, sport) {
  if (!riga || !riga.games) return sport.headline.map(h => ({ short: h.short, v: '—' }));
  return sport.headline.map(h => ({
    short: h.short,
    v: ((riga[h.key] || 0) / riga.games).toFixed(1)
  }));
}

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
// `suParquet` non è un vezzo: sul legno il testo è bianco perché il fondo è
// scuro sempre, in tutti e due i temi. In panchina il gettone sta su un
// pannello di vetro, che in tema chiaro è bianco — e il bianco su bianco è
// esattamente il difetto che c'era.
function Gettone({
  p, foto, sport, riga, armato, suParquet, inTrascinamento, bersaglio,
  onApri, onScambia, onPointerDown, stile
}) {
  const chip = suParquet ? 'su-legno-lieve' : 'bg-pannello/14';
  const siglaCol = suParquet ? 'text-white/60' : 'text-tenue';
  const mediaCol = suParquet ? 'text-white' : 'text-testo';
  const nomeCol = suParquet
    ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.85)]'
    : 'text-testo';
  const numCol = suParquet ? 'text-white/65' : 'text-tenue';
  const anello = armato ? 'ring-blu shadow-blu' : (suParquet ? 'ring-white/70' : 'ring-bordo/20');

  return (
    <div
      style={stile}
      className={cx(
        'flex flex-col items-center transition-opacity',
        suParquet ? 'gettone-campo absolute -translate-x-1/2 -translate-y-1/2' : 'gettone-panca',
        inTrascinamento && 'opacity-30',
        bersaglio && 'scale-105'
      )}
    >
      {/* Le medie sopra la testa: servono a scegliere chi mettere in campo, e
          su un gettone non c'è posto per una tabella. */}
      <div className="mb-1 flex gap-1">
        {medie(riga, sport).map(m => (
          <span key={m.short} className={cx('rounded-full px-1.5 py-0.5 text-center leading-none', chip)}>
            <i
              className={cx('block font-bold uppercase not-italic tracking-etichetta', siglaCol)}
              style={{ fontSize: 'var(--sigla)' }}
            >
              {m.short}
            </i>
            <b className={cx('block font-bold', mediaCol)} style={{ fontSize: 'var(--media)' }}>{m.v}</b>
          </span>
        ))}
      </div>

      <div className="relative">
        <button
          onPointerDown={onPointerDown}
          onClick={onApri}
          title={p.name}
          className={cx('block touch-none', bersaglio && 'transition-transform')}
        >
          <span className={cx('block rounded-full ring-2 transition-all', anello)}>
            {foto ? (
              <img
                src={foto}
                alt=""
                className="rounded-full object-cover"
                style={{ width: 'var(--volto)', height: 'var(--volto)' }}
                draggable="false"
              />
            ) : (
              <span
                className={cx(
                  'grid place-items-center rounded-full font-bold',
                  suParquet ? 'su-legno text-white' : 'vetro-alto text-testo'
                )}
                style={{ width: 'var(--volto)', height: 'var(--volto)', fontSize: 'calc(var(--volto) * 0.3)' }}
              >
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
            'absolute -right-1 -top-1 grid place-items-center rounded-full font-bold transition-all',
            armato
              ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              : suParquet
                ? 'su-legno text-white/85 hover:text-white'
                : 'vetro-alto orlo text-soffuso hover:text-testo'
          )}
          style={{ width: 'var(--scambio)', height: 'var(--scambio)', fontSize: 'calc(var(--scambio) * 0.5)' }}
        >
          ⇄
        </button>
      </div>

      <div
        className={cx('mt-1.5 w-full truncate text-center font-semibold leading-tight', nomeCol)}
        style={{ fontSize: 'var(--nome)' }}
      >
        {p.name}
      </div>
      <div className={cx('font-bold', numCol)} style={{ fontSize: 'var(--numero)' }}>#{p.number}</div>
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
  const [armato, setArmato] = useState(null);
  const [scheda, setScheda] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [trascina, setTrascina] = useState(null);   // { id, x, y, sopra }
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const partenza = useRef(null);
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

  // Scambiare due giocatori qualunque copre tutti e tre i casi con una regola
  // sola: campo↔panchina è una sostituzione, campo↔campo è un cambio di
  // posizione, panchina↔panchina non cambia niente e infatti non fa niente.
  function scambiaCoppia(a, b) {
    if (!a || !b || a === b) return;
    setQuintetto(q => {
      const aDentro = q.includes(a), bDentro = q.includes(b);
      if (aDentro && bDentro) {
        const ia = q.indexOf(a), ib = q.indexOf(b);
        const nuovo = q.slice();
        nuovo[ia] = b; nuovo[ib] = a;
        return nuovo;
      }
      if (aDentro) return q.map(x => (x === a ? b : x));
      if (bDentro) return q.map(x => (x === b ? a : x));
      return q;
    });
  }

  // Il tocco su ⇄ resta: il trascinamento non è raggiungibile da tastiera, e
  // con i guanti d'inverno a bordo campo un tocco secco è più affidabile.
  function armaOScambia(id) {
    if (armato && armato !== id) { scambiaCoppia(armato, id); setArmato(null); return; }
    setArmato(a => (a === id ? null : id));
  }

  /* ---------------------------------------------------------- trascinamento */
  // Eventi puntatore e non l'API HTML5 di drag: quella su telefono non esiste.
  // Così lo stesso codice vale per mouse, dito e pennino.
  function iniziaTrascinamento(e, id) {
    if (e.button != null && e.button !== 0) return;
    partenza.current = { id, x: e.clientX, y: e.clientY, partito: false };

    const muovi = (ev) => {
      const s = partenza.current;
      if (!s) return;
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
      // Sei pixel di tolleranza: sotto è un tocco, non un trascinamento. Senza,
      // ogni tocco un po' storto aprirebbe un trascinamento invece della scheda.
      if (!s.partito && Math.hypot(dx, dy) < 6) return;
      s.partito = true;
      const sotto = document.elementFromPoint(ev.clientX, ev.clientY);
      const zona = sotto && sotto.closest('[data-gettone]');
      const sopra = zona ? zona.getAttribute('data-gettone') : null;
      setTrascina({ id: s.id, x: ev.clientX, y: ev.clientY, sopra: sopra === s.id ? null : sopra });
    };

    const lascia = (ev) => {
      window.removeEventListener('pointermove', muovi);
      window.removeEventListener('pointerup', lascia);
      window.removeEventListener('pointercancel', lascia);
      const s = partenza.current;
      partenza.current = null;
      if (!s || !s.partito) { setTrascina(null); return; }   // era un tocco
      const sotto = document.elementFromPoint(ev.clientX, ev.clientY);
      const zona = sotto && sotto.closest('[data-gettone]');
      const bersaglio = zona ? zona.getAttribute('data-gettone') : null;
      if (bersaglio && bersaglio !== s.id) {
        scambiaCoppia(s.id, bersaglio);
        setArmato(null);
      }
      setTrascina(null);
    };

    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', lascia);
    window.addEventListener('pointercancel', lascia);
  }

  // Se il trascinamento è partito, il clic che segue non deve aprire la scheda.
  function apri(p) {
    if (trascina) return;
    setScheda(p);
  }

  const inMovimento = trascina ? rosa.find(p => p.id === trascina.id) : null;

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
          <Pannello alto className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-bordo/10 px-5 py-3">
              <Etichetta>{sport.field.onFieldLabel}</Etichetta>
              <span className="text-[11.5px] text-tenue">{inCampoP.length} di {inCampo}</span>
            </div>

            <div className="campo parquet relative aspect-[15/14] w-full">
              <div className="righe-campo" dangerouslySetInnerHTML={{ __html: sport.field.svg }} />
              {inCampoP.map((p, i) => {
                const posto = sport.field.slots[i];
                return (
                  <div
                    key={p.id}
                    data-gettone={p.id}
                    className="absolute"
                    style={posto ? { top: posto.top, left: posto.left } : undefined}
                  >
                    <Gettone
                      p={p}
                      foto={foto[p.id]}
                      sport={sport}
                      riga={findSeasonRow(stagione, p)}
                      armato={armato === p.id}
                      suParquet
                      inTrascinamento={trascina && trascina.id === p.id}
                      bersaglio={trascina && trascina.sopra === p.id}
                      onApri={() => apri(p)}
                      onScambia={() => armaOScambia(p.id)}
                      onPointerDown={(e) => iniziaTrascinamento(e, p.id)}
                    />
                  </div>
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
                    <div key={p.id} data-gettone={p.id} className="shrink-0">
                      <Gettone
                        p={p}
                        foto={foto[p.id]}
                        sport={sport}
                        riga={findSeasonRow(stagione, p)}
                        armato={armato === p.id}
                        inTrascinamento={trascina && trascina.id === p.id}
                        bersaglio={trascina && trascina.sopra === p.id}
                        onApri={() => apri(p)}
                        onScambia={() => armaOScambia(p.id)}
                        onPointerDown={(e) => iniziaTrascinamento(e, p.id)}
                      />
                    </div>
                  ))}
                </div>
              </Pannello>
            )}
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
              Trascina un giocatore su un altro per scambiarli. Oppure tocca <b className="text-soffuso">⇄</b> su
              uno e poi <b className="text-soffuso">⇄</b> sull’altro. Tocca il volto per le sue statistiche.
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

      {/* Il fantasma sotto il dito. Fuori dal flusso e senza eventi, altrimenti
          si troverebbe da solo sotto il puntatore e nessun bersaglio verrebbe
          mai riconosciuto. */}
      {inMovimento && (
        <div
          className="pointer-events-none fixed z-[95] -translate-x-1/2 -translate-y-1/2"
          style={{ left: trascina.x, top: trascina.y }}
        >
          <span className="block rounded-full ring-2 ring-blu shadow-blu">
            <Avatar nome={inMovimento.name} url={foto[inMovimento.id]} dim={56} />
          </span>
        </div>
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
    <Finestra
      titolo={p.name}
      sotto={`#${p.number}${p.role_position ? ' · ' + p.role_position : ''}${p.height_cm ? ' · ' + p.height_cm + ' cm' : ''}`}
      onChiudi={onChiudi}
    >
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
