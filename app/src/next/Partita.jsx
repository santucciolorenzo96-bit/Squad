import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchLiveGame, fetchOpenGames, deleteGame } from '../api/games.js';
import { currentSport } from '../utils/sports/index.js';
import { managesSector, canDeleteGame } from '../utils/permissions.js';
import { tabellinoInAltraMano } from '../utils/regole.js';
import { inCampione } from './campione.js';
import { leggiCopia, cancellaCopia, daQuanto } from './partitaLocale.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, cx } from './ui.jsx';
import { Conferma, ErroreCaricamento, useAvviso } from './moduli.jsx';
import { AvvioPartita } from './partitaSetup.jsx';
import { Tracker } from './partitaTracker.jsx';

/* Partita.
 *
 * Tre stati, e la schermata è uno dei tre: c'è un tabellino aperto e lo si
 * segue, non c'è e se ne apre uno, oppure ce n'è uno rimasto aperto in
 * un'altra categoria — e quello va detto, perché una partita dimenticata
 * blocca le altre pur restando invisibile da qui.
 */

/* CHI STA TENENDO IL TABELLINO, E DA QUANTO.
 *
 * Il salvataggio ora non puo' piu' sovrascrivere nessuno — ci pensa la
 * revisione — ma scoprirlo al primo tocco vuol dire scoprirlo dopo aver
 * segnato qualcosa che andra' perso. Questo serve a saperlo PRIMA.
 *
 * Tre minuti e non di piu': un tabellino salvato l'ultima volta cinque minuti
 * fa non e' in mano a nessuno, e' stato abbandonato — e' la palestra dove e'
 * finito il primo tempo, o il telefono che si e' scaricato. Un blocco che non
 * scade e' un tabellino che nessuno puo' piu' riprendere.
 */
// La regola sta in regole.js, dove si puo' provare. Qui si aggiunge solo il
// nome: chi tiene il tabellino e' una persona, e dirlo per nome cambia cosa
// si fa dopo — si va a cercarla, invece di chiedersi chi sia.
function altraMano(g) {
  if (!tabellinoInAltraMano(g, (state.currentUser || {}).id)) return null;
  const chi = (state.staff || []).find(x => x.id === g.tenutoDa);
  return { nome: (chi && chi.display_name) || 'un altro dispositivo' };
}

function ScoutOccupato({ mano, partita, onPrendo, onIndietro }) {
  return (
    <>
      <Titolo sopra="Categoria">Scout</Titolo>
      <div className="mt-5">
        <Pannello alto className="pad-pannello-stretto">
          <Etichetta className="!text-ambra">Tabellino gia’ in mano</Etichetta>
          <p className="mt-3 text-[13.5px] leading-relaxed">
            <b>{mano.nome}</b> sta segnando {partita.oppName ? '«' + partita.oppName + '»' : 'questa partita'} in
            questo momento, da un altro dispositivo.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">
            Un tabellino si tiene in uno alla volta. Se entri anche tu, le azioni segnate da
            uno dei due non arriveranno mai — e ve ne accorgereste contando i punti a fine
            partita.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pulsante variante="primario" onClick={onIndietro}>Va bene, guardo altrove</Pulsante>
            <Pulsante onClick={onPrendo}>Prendo io il tabellino</Pulsante>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-tenue">
            Prendilo solo se sai che l’altro ha smesso: da quel momento il suo scout non
            salva piu’ e glielo dice.
          </p>
        </Pannello>
      </div>
    </>
  );
}

/* Si e' usciti dallo scout, ma la partita e' ancora aperta.
 *
 * Non e' una schermata di lavoro: e' un cartello che dice dove si era rimasti e
 * come tornarci. Il punteggio si vede perche' e' l'unica cosa che serve
 * sapere da fuori. */
function PartitaInCorso({ sport, onRientra, onScarta }) {
  const g = state.liveGame || {};
  const conf = sport.scout;
  // Lo stesso numero che si vede nello scout: quello vivo. Nella pallavolo
  // teamScore sono i set, e un «0–0» mentre il primo set è a metà direbbe
  // il falso.
  const perSet = conf.scoreDisplay === 'setsWon';
  const vivo = (g.periodScores || [])[(g.quarter || 1) - 1] || { us: 0, them: 0 };
  const nostri = perSet ? vivo.us : g.teamScore;
  const loro = perSet ? vivo.them : g.oppScore;
  return (
    <>
      <Titolo sopra="Categoria">Scout</Titolo>
      <div className="mt-5">
        <Pannello alto className="pad-pannello-stretto">
          <Etichetta className="!text-verde">Partita in corso</Etichetta>
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">
                {(state.teamProfile || {}).name} – {g.oppName}
              </div>
              <div className="mt-0.5 text-[12.5px] text-tenue">
                {conf.period.label} {g.quarter}{g.friendly ? ' · amichevole' : ''}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="cifra text-[24px] font-bold leading-none">{nostri}–{loro}</div>
              {perSet && (
                <div className="mt-1 text-[11px] font-bold uppercase tracking-etichetta text-tenue">
                  set {g.teamScore}–{g.oppScore}
                </div>
              )}
            </div>
          </div>
          <Pulsante variante="primario" className="mt-4 w-full" onClick={onRientra}>
            Torna allo scout
          </Pulsante>
          <p className="mt-3 text-[12.5px] leading-relaxed text-tenue">
            Finché non chiudi la partita dallo scout, il tabellino resta aperto e questa
            categoria non ne può iniziare un’altra.
          </p>

          {/* LA VIA D'USCITA CHE MANCAVA.
              Un tabellino aperto per sbaglio — o su una partita poi non
              giocata — si poteva soltanto CHIUDERE, e chiuderlo vuol dire
              mandarlo in archivio: da li' e' finito nello storico, con il suo
              punteggio finto, a sporcare record e statistiche. Scartare una
              partita mai giocata e archiviarla sono due cose diverse, e
              finora ce n'era una sola. */}
          {onScarta && (
            <button
              onClick={onScarta}
              className="mt-3 w-full rounded-lg py-2 text-[12.5px] font-semibold text-rosso transition-colors hover:bg-rosso/10"
            >
              Scarta il tabellino: questa partita non si è giocata
            </button>
          )}
        </Pannello>
      </div>
    </>
  );
}

export function Partita() {
  const sport = currentSport();
  const [fase, setFase] = useState('carico');   // carico | vuoto | live | recupero
  const [recupero, setRecupero] = useState(null);
  const [scout, setScout] = useState(true);    // lo scout occupa tutta la finestra
  const [errore, setErrore] = useState(null);
  const [aperte, setAperte] = useState([]);
  const [prendoIo, setPrendoIo] = useState(false);
  const [daScartare, setDaScartare] = useState(null);
  const avvisa = useAvviso();

  function carica() {
    if (inCampione()) { setFase('vuoto'); return; }
    setFase('carico');
    setErrore(null);
    Promise.all([
      fetchLiveGame(state.activeSectorId),
      fetchOpenGames(state.teamProfile.id).catch(() => [])
    ]).then(([viva, tutte]) => {
      const locale = leggiCopia(state.activeSectorId);

      if (viva && locale && locale.gameId === viva.id && !locale.sincronizzata) {
        // La copia di qui non era ancora arrivata al server: e' quella avanti,
        // e riparte lei. La `daRisincronizzare` fa spedire subito il recupero.
        viva = { ...locale.gioco, daRisincronizzare: true };
        avvisa('Ripresa dalla copia salvata su questo dispositivo');
      } else if (!viva && locale) {
        // Il server dice che non c'e' nessuna partita aperta: e' stata chiusa
        // o scartata altrove. La copia qui non serve piu', e tenerla vorrebbe
        // dire riproporre un fantasma a ogni apertura.
        cancellaCopia(state.activeSectorId);
      }

      state.liveGame = viva;
      setAperte((tutte || []).filter(x => x.sector_id !== state.activeSectorId));
      // Se una partita e' aperta si entra dritti nello scout: chi apre questa
      // sezione durante una partita non ci arriva per curiosare.
      setScout(true);
      setFase(viva ? 'live' : 'vuoto');
    }).catch(e => {
      // Server irraggiungibile. Se qui c'e' una partita salvata, questo e'
      // esattamente il momento per cui l'abbiamo scritta.
      const locale = leggiCopia(state.activeSectorId);
      if (locale) { setRecupero(locale); setFase('recupero'); return; }
      setErrore(e);
    });
  }
  useEffect(carica, [state.activeSectorId]);

  if (!sport.match.liveTracker) {
    return (
      <div className="sezioni">
        <Titolo sopra="Categoria">Scout</Titolo>
        <Vuoto>Per {sport.label.toLowerCase()} il tabellino dal vivo non è previsto.</Vuoto>
      </div>
    );
  }

  if (errore) return <ErroreCaricamento cosa="la partita" errore={errore} onRiprova={carica} />;

  // Senza rete, ma con una partita sul dispositivo: si riparte da li'.
  if (fase === 'recupero' && recupero) {
    return (
      <>
        <Titolo sopra="Categoria">Scout</Titolo>
        <div className="mt-5">
          <Pannello alto className="pad-pannello-stretto">
            <Etichetta className="!text-ambra">Server non raggiungibile</Etichetta>
            <p className="mt-3 text-[13.5px] leading-relaxed">
              Su questo dispositivo c’è una partita contro{' '}
              <b>{recupero.gioco.oppName}</b>, aggiornata {daQuanto(recupero)}
              {recupero.sincronizzata ? '' : ' e non ancora spedita'}.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">
              Puoi continuare a segnare da qui: quando la rete torna, il tabellino riparte da solo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pulsante
                variante="primario"
                onClick={() => {
                  state.liveGame = { ...recupero.gioco, daRisincronizzare: true };
                  setScout(true);
                  setFase('live');
                }}
              >
                Continua da qui
              </Pulsante>
              <Pulsante onClick={carica}>Riprova a collegarti</Pulsante>
            </div>
          </Pannello>
        </div>
      </>
    );
  }

  /* La conferma sta fuori dai rami perche' serve in due: nell'elenco delle
     partite rimaste aperte altrove, e sul cartello della partita di qui. */
  const puoiScartare = canDeleteGame(
    state.currentUser, state.activeSectorId, state.staffSectors, { aperta: true }
  );

  const confermaScarto = daScartare ? (
    <Conferma
      titolo="Scartare il tabellino?"
      testo={`${daScartare.opp_name}: il tabellino aperto viene cancellato e non si recupera.`
        + (daScartare.corrente ? ' Non finisce nello storico, perche’ non e’ stata giocata.' : '')}
      etichetta="Scarta"
      onChiudi={() => setDaScartare(null)}
      onConferma={async () => {
        await deleteGame(daScartare.id);
        cancellaCopia(daScartare.sector_id || state.activeSectorId);
        if (daScartare.corrente) {
          state.liveGame = null;
          state.undoStack = [];
          state.undoTesti = [];
          avvisa('Tabellino scartato');
          carica();
          return;
        }
        setAperte(v => v.filter(x => x.id !== daScartare.id));
        avvisa('Tabellino scartato');
      }}
    />
  ) : null;

  if (fase === 'carico') {
    return <><Titolo sopra="Categoria">Scout</Titolo><div className="mt-5"><Scheletro righe={3} /></div></>;
  }

  if (fase === 'live') {
    const finita = () => { avvisa('Partita archiviata'); carica(); };

    // Prima di tutto: il tabellino e' in mano a qualcun altro?
    const mano = prendoIo ? null : altraMano(state.liveGame);
    if (mano) {
      return (
        <ScoutOccupato
          mano={mano}
          partita={state.liveGame}
          onPrendo={() => { setPrendoIo(true); setScout(true); }}
          onIndietro={() => setScout(false)}
        />
      );
    }

    if (scout) {
      return (
        <>
          <Tracker onEsci={() => setScout(false)} onFinita={finita} />
          {confermaScarto}
        </>
      );
    }
    return (
      <>
        <PartitaInCorso
          sport={sport}
          onRientra={() => setScout(true)}
          onScarta={puoiScartare && !inCampione()
            ? () => setDaScartare({
                id: state.liveGame.id,
                opp_name: state.liveGame.oppName,
                sector_id: state.liveGame.sectorId,
                corrente: true
              })
            : null}
        />
        {confermaScarto}
      </>
    );
  }

  return (
    <>
      {/* Le partite lasciate aperte altrove: bloccano quella categoria e da lì
          non si vedono. Chiuderle da qui è l'unico modo di uscirne. */}
      {aperte.length > 0 && (
        <div className="mb-5">
          <Pannello className="pad-pannello-stretto">
            <Etichetta className="!text-ambra">Partite rimaste aperte altrove</Etichetta>
            <div className="mt-3 space-y-2">
              {aperte.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg bg-pannello/8 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">
                      {(a.sectors && a.sectors.name) || 'Altra categoria'} · {a.opp_name}
                    </div>
                    <div className="text-[12.5px] text-tenue">
                      aperta il {new Date(a.started_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                  <Pulsante className="shrink-0 py-1.5 text-[12.5px]" onClick={() => setDaScartare(a)}>
                    Scarta
                  </Pulsante>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-tenue">
              Finché restano aperte, quelle categorie non possono aprire un tabellino nuovo.
              Scartarle cancella il tabellino: se la partita è stata giocata davvero, il
              risultato si scrive dal Calendario.
            </p>
          </Pannello>
        </div>
      )}

      {/* Chi vede questa categoria perche' ci gioca non ci apre tabellini: il
          database rifiuterebbe comunque la scrittura, e un modulo che si
          compila per poi fallire e' peggio di un modulo che non c'e'. Fa
          eccezione chi ha il permesso di segnare, che esiste apposta per il
          genitore a bordo campo. */}
      {(managesSector(state.currentUser, state.activeSectorId, state.staffSectors)
        || state.currentUser.can_score_matches) ? (
        <AvvioPartita onAvviata={() => { setScout(true); setFase('live'); avvisa('Partita avviata'); }} />
      ) : (
        <Vuoto>
          Qui non apri tabellini: questa categoria la vedi perché c’è una scheda atleta
          collegata al tuo account. Il tabellino lo tiene chi la allena.
        </Vuoto>
      )}

      {confermaScarto}
    </>
  );
}
