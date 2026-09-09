import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchLiveGame, fetchOpenGames, discardGame } from '../api/games.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
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

export function Partita() {
  const sport = currentSport();
  const [fase, setFase] = useState('carico');   // carico | vuoto | live
  const [errore, setErrore] = useState(null);
  const [aperte, setAperte] = useState([]);
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
      state.liveGame = viva;
      setAperte((tutte || []).filter(x => x.sector_id !== state.activeSectorId));
      setFase(viva ? 'live' : 'vuoto');
    }).catch(setErrore);
  }
  useEffect(carica, [state.activeSectorId]);

  if (!sport.match.liveTracker) {
    return (
      <div className="sezioni">
        <Titolo sopra="Categoria">Partita</Titolo>
        <Vuoto>Per {sport.label.toLowerCase()} il tabellino dal vivo non è previsto.</Vuoto>
      </div>
    );
  }

  if (errore) return <ErroreCaricamento cosa="la partita" errore={errore} onRiprova={carica} />;

  if (fase === 'carico') {
    return <><Titolo sopra="Categoria">Partita</Titolo><div className="mt-5"><Scheletro righe={3} /></div></>;
  }

  if (fase === 'live') {
    return <Tracker onFinita={() => { avvisa('Partita archiviata'); carica(); }} />;
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
                    <div className="text-[11.5px] text-tenue">
                      aperta il {new Date(a.started_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                  <Pulsante className="shrink-0 py-1.5 text-[11.5px]" onClick={() => setDaScartare(a)}>
                    Scarta
                  </Pulsante>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
              Finché restano aperte, quelle categorie non possono aprire un tabellino nuovo.
              Scartarle cancella il tabellino: se la partita è stata giocata davvero, il
              risultato si scrive dal Calendario.
            </p>
          </Pannello>
        </div>
      )}

      <AvvioPartita onAvviata={() => { setFase('live'); avvisa('Partita avviata'); }} />

      {daScartare && (
        <Conferma
          titolo="Scartare il tabellino?"
          testo={`${daScartare.opp_name}: il tabellino aperto viene cancellato e non si recupera.`}
          etichetta="Scarta"
          onChiudi={() => setDaScartare(null)}
          onConferma={async () => {
            await discardGame(daScartare.id);
            setAperte(v => v.filter(x => x.id !== daScartare.id));
            avvisa('Tabellino scartato');
          }}
        />
      )}
    </>
  );
}
