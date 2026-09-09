import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { addPlayer, removePlayerFromSector, fetchPlayerPhotoUrls } from '../api/roster.js';
import { canEditRoster } from '../utils/permissions.js';
import { computeSeasonStats, findSeasonRow } from '../utils/stats.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Avatar, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso } from './moduli.jsx';
import { IconaSezione, Chevron } from './icone.jsx';

/* La rosa.
 *
 * È l'elenco della squadra, e va letto come tale: numero di maglia a sinistra,
 * incolonnato, poi il volto, poi il nome. Le statistiche di stagione stanno a
 * destra e solo se ci sono partite giocate — una colonna di zeri a settembre
 * non informa nessuno, occupa e basta.
 */

export function Rosa() {
  const [foto, setFoto] = useState({});
  const [caricato, setCaricato] = useState(false);
  const [nuovo, setNuovo] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const sport = currentSport();
  const puoiModificare = canEditRoster(state.currentUser);
  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    if (rosa.length === 0 || inCampione()) { setCaricato(true); return; }
    fetchPlayerPhotoUrls(rosa).catch(() => ({})).then(f => {
      if (vivo) { setFoto(f); setCaricato(true); }
    });
    return () => { vivo = false; };
  }, [rosa]);

  const stagione = computeSeasonStats(state.history, sport);
  const conPartite = state.history.length > 0;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={puoiModificare
          ? <Pulsante variante="primario" onClick={() => setNuovo(true)}>+ Giocatore</Pulsante>
          : <span className="shrink-0 text-[12.5px] text-tenue">{rosa.length} in rosa</span>}
      >
        Rosa
      </Titolo>

      {!caricato ? (
        <Scheletro righe={5} />
      ) : rosa.length === 0 ? (
        <Vuoto>
          Nessun giocatore in questa categoria.
          {puoiModificare && ' Aggiungine uno: bastano numero e nome, il resto si completa dall’Anagrafica.'}
        </Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {rosa.map((p, i) => {
            const riga = conPartite ? findSeasonRow(stagione, p) : null;
            return (
              <div
                key={p.id}
                className={cx(
                  'flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-pannello/8 sm:px-5',
                  i > 0 && 'border-t border-bordo/6'
                )}
              >
                <span className="w-8 shrink-0 text-right text-[17px] font-medium text-tenue">
                  {p.number}
                </span>
                <Avatar nome={p.name} url={foto[p.id]} dim={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">{p.name}</div>
                  {p.role_position && (
                    <div className="text-[11.5px] text-tenue">{p.role_position}</div>
                  )}
                </div>

                {/* Le statistiche compaiono solo se c'è una stagione alle
                    spalle, e solo da tablet in su: su telefono la riga deve
                    restare leggibile, non completa. */}
                {riga && (
                  <div className="hidden shrink-0 items-center gap-5 sm:flex">
                    {sport.seasonColumns.slice(0, 3).map(c => (
                      <div key={c.key} className="text-right">
                        <div className="text-[15px] font-semibold leading-none">
                          {riga[c.key] == null ? '—' : riga[c.key]}
                        </div>
                        <Etichetta className="mt-1">{c.short || c.label}</Etichetta>
                      </div>
                    ))}
                  </div>
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
            );
          })}
        </Pannello>
      )}

      {nuovo && (
        <ModuloGiocatore
          onChiudi={() => setNuovo(false)}
          onFatto={(creato) => {
            state.roster.push(creato);
            ridisegna(n => n + 1);
            avvisa('Giocatore aggiunto');
          }}
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
            ridisegna(n => n + 1);
            avvisa('Giocatore tolto dalla categoria');
          }}
        />
      )}
    </div>
  );
}

function ModuloGiocatore({ onChiudi, onFatto }) {
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');

  return (
    <Modulo
      titolo="Nuovo giocatore"
      sotto="Bastano numero e nome. Data di nascita, ruolo e documenti si completano dall’Anagrafica."
      etichettaInvia="Aggiungi"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Scrivi il nome del giocatore.';
        // Il numero è testo di proposito: "00" esiste, e nel minibasket capita
        // di non averne affatto.
        const creato = await addPlayer(
          state.teamProfile.id, state.activeSectorId,
          numero.trim() || '-', n, state.activeSeasonId
        );
        onFatto(creato);
      }}
    >
      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
        <Campo etichetta="Numero">
          <Testo value={numero} onChange={e => setNumero(e.target.value)} placeholder="7" maxLength={3} />
        </Campo>
        <Campo etichetta="Nome e cognome">
          <Testo value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" autoFocus />
        </Campo>
      </div>
    </Modulo>
  );
}
