import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { closeSeasonAndOpen } from '../api/seasons.js';
import { fetchRosterBySector } from '../api/roster.js';
import { orderedSectors, sectorFullName } from '../utils/sectors.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Vuoto, Scheletro, Avatar, cx } from './ui.jsx';
import { Finestra, Campo, Testo, Data, Scelta, useAvviso } from './moduli.jsx';

/* La chiusura di una stagione.
 *
 * Non è un interruttore: è il momento in cui si decide chi passa di categoria.
 * Quanti ragazzi salgano dall'Under 15 all'Under 17 non lo sa nessuno in
 * anticipo — dipende dalle date di nascita, da chi smette, da chi arriva —
 * quindi qui NON c'è nessuna regola automatica. C'è un elenco, e per ognuno si
 * sceglie.
 *
 * La destinazione proposta è la stessa categoria, non quella successiva:
 * indovinare le promozioni e sbagliarle in massa costerebbe più tempo di
 * quanto ne farebbe risparmiare.
 *
 * Chi resta fuori NON viene cancellato da niente: resta in anagrafica, nello
 * storico delle partite e nelle statistiche della stagione appena chiusa.
 * Semplicemente non fa parte di nessuna rosa di quella nuova.
 */

const FUORI = '__fuori__';

function nomeSuccessiva(nome) {
  const m = (nome || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
  if (m) {
    const a = parseInt(m[1], 10) + 1;
    const b = m[2].length === 2 ? String(parseInt(m[2], 10) + 1).padStart(2, '0') : String(parseInt(m[2], 10) + 1);
    return `${a}/${b}`;
  }
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

export function ChiusuraStagione({ stagione, onChiudi, onFatta }) {
  const [rose, setRose] = useState(null);
  const [scelte, setScelte] = useState({});
  const [errore, setErrore] = useState('');
  const [lavora, setLavora] = useState(false);
  const avvisa = useAvviso();

  const settori = orderedSectors(state.sectors);
  const annoFine = stagione.end_date ? new Date(stagione.end_date).getFullYear() : new Date().getFullYear();

  const [nome, setNome] = useState(nomeSuccessiva(stagione.name));
  const [inizio, setInizio] = useState(`${annoFine}-09-01`);
  const [fine, setFine] = useState(`${annoFine + 1}-06-30`);

  useEffect(() => {
    let vivo = true;
    if (inCampione()) {
      const r = settori.map(s => (s.id === state.activeSectorId ? state.roster : []));
      setRose(r);
      const iniziali = {};
      settori.forEach((s, i) => (r[i] || []).forEach(p => { iniziali[p.id] = s.id; }));
      setScelte(iniziali);
      return;
    }
    Promise.all(settori.map(s => fetchRosterBySector(s.id, stagione.id)))
      .then(r => {
        if (!vivo) return;
        setRose(r);
        const iniziali = {};
        settori.forEach((s, i) => (r[i] || []).forEach(p => { iniziali[p.id] = s.id; }));
        setScelte(iniziali);
      })
      .catch(() => { if (vivo) setErrore('Non è stato possibile leggere le rose della stagione.'); });
    return () => { vivo = false; };
  }, []);

  const passano = Object.values(scelte).filter(v => v !== FUORI).length;
  const restano = Object.values(scelte).filter(v => v === FUORI).length;
  const totale = passano + restano;

  async function esegui() {
    setErrore('');
    if (!nome.trim()) { setErrore('Dai un nome alla stagione nuova.'); return; }
    if (fine <= inizio) { setErrore('La fine deve venire dopo l’inizio.'); return; }
    if (inCampione()) { setErrore('Nell’anteprima con dati di esempio non si chiude niente.'); return; }
    setLavora(true);
    try {
      const assegnazioni = Object.entries(scelte)
        .filter(([, sector_id]) => sector_id !== FUORI)
        .map(([player_id, sector_id]) => ({ player_id, sector_id }));
      await closeSeasonAndOpen(stagione.id, {
        name: nome.trim(), start_date: inizio, end_date: fine
      }, assegnazioni);
      avvisa(`Stagione ${nome.trim()} aperta con ${passano} ${passano === 1 ? 'giocatore' : 'giocatori'}`);
      onFatta();
    } catch (e) {
      console.error(e);
      setErrore((e && e.message) || 'Chiusura non riuscita.');
    } finally {
      setLavora(false);
    }
  }

  return (
    <Finestra
      titolo={`Chiudi la stagione ${stagione.name}`}
      sotto="Si apre la stagione nuova e si decide chi ne fa parte. Chi resta fuori non viene cancellato: esce solo dalle rose."
      onChiudi={lavora ? () => {} : onChiudi}
      larga
      azioni={
        <>
          {errore && (
            <div className="mb-3 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] leading-snug text-rosso">
              {errore}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-tenue">
              <b className="text-testo">{passano}</b> passano · <b className="text-testo">{restano}</b> restano fuori
            </span>
            <div className="flex gap-2">
              <Pulsante variante="nudo" onClick={onChiudi} disabled={lavora}>Annulla</Pulsante>
              <Pulsante variante="primario" onClick={esegui} disabled={lavora || !rose}>
                {lavora ? 'Chiusura…' : 'Chiudi e apri la nuova'}
              </Pulsante>
            </div>
          </div>
        </>
      }
    >
      {/* -------------------------------------------------- la nuova stagione */}
      <div>
        <Etichetta className="mb-2.5">La stagione nuova</Etichetta>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etichetta="Nome"><Testo value={nome} onChange={e => setNome(e.target.value)} /></Campo>
          <Campo etichetta="Inizio"><Data value={inizio} onChange={e => setInizio(e.target.value)} /></Campo>
          <Campo etichetta="Fine"><Data value={fine} onChange={e => setFine(e.target.value)} /></Campo>
        </div>
      </div>

      {/* ------------------------------------------------------- i giocatori */}
      <div className="mt-6">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <Etichetta>Chi passa, e dove</Etichetta>
          {totale > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const t = {};
                  settori.forEach((s, i) => (rose[i] || []).forEach(p => { t[p.id] = s.id; }));
                  setScelte(t);
                }}
                className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-tenue hover:text-testo"
              >
                Tutti nella stessa
              </button>
              <button
                onClick={() => {
                  const t = {};
                  Object.keys(scelte).forEach(id => { t[id] = FUORI; });
                  setScelte(t);
                }}
                className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-tenue hover:text-testo"
              >
                Nessuno
              </button>
            </div>
          )}
        </div>

        {!rose ? (
          <Scheletro righe={4} />
        ) : totale === 0 ? (
          <Vuoto>
            Nessun giocatore nelle rose di questa stagione. La stagione nuova parte vuota, e le
            rose si compongono dall’Anagrafica.
          </Vuoto>
        ) : (
          <div className="space-y-4">
            {settori.map((s, i) => {
              const rosa = rose[i] || [];
              if (rosa.length === 0) return null;
              return (
                <div key={s.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] font-semibold">{sectorFullName(s, state.sectors)}</span>
                    <span className="text-[11.5px] text-tenue">{rosa.length}</span>
                  </div>
                  <Pannello className="overflow-hidden">
                    {rosa.map((p, j) => {
                      const dove = scelte[p.id] || FUORI;
                      const fuori = dove === FUORI;
                      return (
                        <div
                          key={p.id}
                          className={cx(
                            'flex items-center gap-3 px-3.5 py-2.5',
                            j > 0 && 'border-t border-bordo/6',
                            fuori && 'opacity-55'
                          )}
                        >
                          <span className="w-6 shrink-0 text-right text-[12.5px] text-tenue">{p.number}</span>
                          <Avatar nome={p.name} dim={28} />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</span>
                          <Scelta
                            value={dove}
                            onChange={e => setScelte(v => ({ ...v, [p.id]: e.target.value }))}
                            className="w-auto shrink-0 py-1.5 text-[12px]"
                          >
                            {settori.map(d => (
                              <option key={d.id} value={d.id}>{sectorFullName(d, state.sectors)}</option>
                            ))}
                            <option value={FUORI}>— non prosegue —</option>
                          </Scelta>
                        </div>
                      );
                    })}
                  </Pannello>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
          La destinazione proposta è la stessa categoria, non quella successiva: nessuno sa in
          anticipo chi sale, e indovinare in massa costerebbe più tempo di quanto ne farebbe
          risparmiare. Chi non prosegue resta in anagrafica, nello storico delle partite e nelle
          statistiche della stagione che si chiude.
        </p>
      </div>
    </Finestra>
  );
}
