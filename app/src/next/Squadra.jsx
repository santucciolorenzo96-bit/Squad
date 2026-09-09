import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { updateTeam, regenerateInviteCode } from '../api/teams.js';
import { createSector, renameSector, removeSector } from '../api/sectors.js';
import { fetchSeasons, createSeason, updateSeason, removeSeason, reopenSeason } from '../api/seasons.js';
import { orderedSectors, hasChildren } from '../utils/sectors.js';
import { isAdmin } from '../utils/permissions.js';
import { SPORT_LIST } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, ErroreCaricamento, useAvviso } from './moduli.jsx';

/* Squadra.
 *
 * Le impostazioni della società: identità, categorie, stagioni, codice invito.
 * Sono cose che si toccano poche volte l'anno, quindi stanno una sotto l'altra
 * invece che dietro a delle schede: cercare in quale scheda stia una cosa che
 * si fa a settembre è peggio che scorrere.
 */

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Squadra() {
  const avvisa = useAvviso();
  if (!isAdmin(state.currentUser)) {
    return (
      <div className="sezioni">
        <Titolo sopra="Società">Squadra</Titolo>
        <Vuoto>Solo un amministratore può cambiare le impostazioni della società.</Vuoto>
      </div>
    );
  }
  return (
    <div className="sezioni">
      <Titolo sopra="Società">Squadra</Titolo>
      <Identita avvisa={avvisa} />
      <Categorie avvisa={avvisa} />
      <Stagioni avvisa={avvisa} />
      <CodiceInvito avvisa={avvisa} />
    </div>
  );
}

/* ================================================================ identità */
function Identita({ avvisa }) {
  const [modifica, setModifica] = useState(false);
  const [, ridisegna] = useState(0);
  const t = state.teamProfile || {};
  const sport = SPORT_LIST.find(s => s.key === t.sport);

  return (
    <div>
      <Etichetta className="mb-2.5">Identità</Etichetta>
      <Pannello className="pad-pannello-stretto">
        <div className="flex items-center gap-4">
          {t.logo_url ? (
            <img src={t.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blu to-blu2 text-[20px] font-bold text-white shadow-blu">
              {(t.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-bold leading-tight">{t.name}</div>
            <div className="mt-1 text-[12.5px] text-tenue">
              {[t.city, t.category, sport && sport.label].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Pulsante className="shrink-0 py-1.5 text-[11.5px]" onClick={() => setModifica(true)}>Modifica</Pulsante>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
          Il logo si carica dall’app attuale: il ritaglio con trasparenza non è ancora stato rifatto qui.
        </p>
      </Pannello>

      {modifica && (
        <ModuloIdentita
          onChiudi={() => setModifica(false)}
          onFatto={() => { ridisegna(n => n + 1); avvisa('Società salvata'); }}
        />
      )}
    </div>
  );
}

function ModuloIdentita({ onChiudi, onFatto }) {
  const t = state.teamProfile || {};
  const [nome, setNome] = useState(t.name || '');
  const [citta, setCitta] = useState(t.city || '');
  const [categoria, setCategoria] = useState(t.category || '');

  return (
    <Modulo
      titolo="Modifica società"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Il nome della società non può restare vuoto.';
        const agg = await updateTeam(t.id, {
          name: n, city: citta.trim() || null, category: categoria.trim() || null
        });
        Object.assign(state.teamProfile, agg);
        onFatto();
      }}
    >
      <Campo etichetta="Nome"><Testo value={nome} onChange={e => setNome(e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Città"><Testo value={citta} onChange={e => setCitta(e.target.value)} /></Campo>
        <Campo etichetta="Categoria"><Testo value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Es. Serie D" /></Campo>
      </div>
      <p className="text-[11.5px] leading-relaxed text-tenue">
        Lo sport non si cambia da qui: cambierebbe il significato di tutte le statistiche già raccolte.
      </p>
    </Modulo>
  );
}

/* =============================================================== categorie */
function Categorie({ avvisa }) {
  const [modulo, setModulo] = useState(null);   // {padre} | {sector}
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const elenco = orderedSectors(state.sectors);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Etichetta>Categorie</Etichetta>
        <Pulsante variante="primario" className="py-1.5 text-[11.5px]" onClick={() => setModulo({ padre: null })}>
          + Categoria
        </Pulsante>
      </div>

      {elenco.length === 0 ? (
        <Vuoto>Nessuna categoria creata. Ogni categoria ha rosa, allenamenti e partite proprie.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {elenco.map((s, i) => (
            <div
              key={s.id}
              className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
              style={s.parent_id ? { paddingLeft: '2.25rem' } : undefined}
            >
              {s.parent_id && <span className="shrink-0 text-tenue">└</span>}
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{s.name}</span>
              {!s.parent_id && (
                <button
                  onClick={() => setModulo({ padre: s })}
                  title="Aggiungi sottocategoria"
                  className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-pannello/12 hover:text-testo"
                >
                  +
                </button>
              )}
              <button
                onClick={() => setModulo({ sector: s })}
                title="Rinomina"
                className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-pannello/12 hover:text-testo"
              >
                ✎
              </button>
              <button
                onClick={() => setDaRimuovere(s)}
                title="Elimina"
                className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-rosso/12 hover:text-rosso"
              >
                ✕
              </button>
            </div>
          ))}
        </Pannello>
      )}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
        Una categoria può avere sottocategorie: due squadre nella stessa annata, o un minibasket
        diviso per età. Ognuna ha rosa, allenamenti e partite proprie.
      </p>

      {modulo && (
        <ModuloCategoria
          padre={modulo.padre}
          sector={modulo.sector}
          onChiudi={() => setModulo(null)}
          onFatto={(msg) => { ridisegna(n => n + 1); avvisa(msg); }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Eliminare la categoria?"
          testo={`«${daRimuovere.name}» viene eliminata insieme a rosa, partite, classifica e allenamenti collegati.`
            + (hasChildren(daRimuovere, state.sectors) ? ' Anche le sue sottocategorie, con tutto quello che contengono.' : '')
            + ' Operazione irreversibile.'}
          etichetta="Elimina"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removeSector(daRimuovere.id);
            state.sectors = state.sectors.filter(s => s.id !== daRimuovere.id && s.parent_id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Categoria eliminata');
          }}
        />
      )}
    </div>
  );
}

function ModuloCategoria({ padre, sector, onChiudi, onFatto }) {
  const [nome, setNome] = useState(sector ? sector.name : '');
  const titolo = sector ? 'Rinomina categoria' : (padre ? 'Sottocategoria di ' + padre.name : 'Nuova categoria');

  return (
    <Modulo
      titolo={titolo}
      sotto={padre ? `Avrà rosa, allenamenti e partite proprie, separate da quelle di ${padre.name}.` : null}
      etichettaInvia={sector ? 'Salva' : 'Crea'}
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Inserisci un nome.';
        if (sector) {
          await renameSector(sector.id, n);
          sector.name = n;
          onFatto('Categoria rinominata');
        } else {
          const creato = await createSector(state.teamProfile.id, n, padre ? padre.id : null);
          state.sectors.push(creato);
          onFatto(padre ? 'Sottocategoria creata' : 'Categoria creata');
        }
      }}
    >
      <Campo etichetta="Nome">
        <Testo value={nome} onChange={e => setNome(e.target.value)} placeholder={padre ? 'Blu' : 'Under 15'} autoFocus />
      </Campo>
    </Modulo>
  );
}

/* ================================================================ stagioni */
function Stagioni({ avvisa }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [nuova, setNuova] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState(null);

  function carica() {
    if (inCampione()) { setDati([]); return; }
    setDati(null);
    fetchSeasons(state.teamProfile.id).then(d => { setDati(d); state.seasons = d; }).catch(setErrore);
  }
  useEffect(carica, []);

  if (errore) return <ErroreCaricamento cosa="le stagioni" errore={errore} onRiprova={carica} />;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Etichetta>Stagioni</Etichetta>
        <Pulsante variante="primario" className="py-1.5 text-[11.5px]" onClick={() => setNuova(true)}>
          + Stagione
        </Pulsante>
      </div>

      {!dati ? (
        <Scheletro righe={2} />
      ) : dati.length === 0 ? (
        <Vuoto>
          Nessuna stagione. Serve a tenere separati i dati di un anno dall’altro: senza, rose e
          statistiche si accumulano tutte insieme.
        </Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {dati.map((s, i) => (
            <div
              key={s.id}
              className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold leading-tight">{s.name}</div>
                <div className="text-[11.5px] text-tenue">
                  {fmtData(s.start_date)} → {fmtData(s.end_date)}
                </div>
              </div>
              {s.closed_at ? <Stato>Chiusa</Stato> : <Stato tono="buono">In corso</Stato>}
              {s.closed_at && (
                <Pulsante
                  className="shrink-0 py-1.5 text-[11.5px]"
                  onClick={async () => {
                    try { await reopenSeason(s.id); s.closed_at = null; carica(); avvisa('Stagione riaperta'); }
                    catch (e) { avvisa((e && e.message) || 'Non riuscita.', 'errore'); }
                  }}
                >
                  Riapri
                </Pulsante>
              )}
              <button
                onClick={() => setDaRimuovere(s)}
                title="Elimina"
                className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-rosso/12 hover:text-rosso"
              >
                ✕
              </button>
            </div>
          ))}
        </Pannello>
      )}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
        La chiusura di una stagione con il passaggio dei giocatori alla successiva è ancora
        sull’app attuale: è la parte più delicata e la porto per ultima.
      </p>

      {nuova && (
        <ModuloStagione onChiudi={() => setNuova(false)} onFatto={() => { carica(); avvisa('Stagione creata'); }} />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Eliminare la stagione?"
          testo={`«${daRimuovere.name}» viene eliminata. I dati che vi erano legati restano, ma senza stagione di appartenenza.`}
          etichetta="Elimina"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => { await removeSeason(daRimuovere.id); carica(); avvisa('Stagione eliminata'); }}
        />
      )}
    </div>
  );
}

function ModuloStagione({ onChiudi, onFatto }) {
  const anno = new Date().getFullYear();
  const [nome, setNome] = useState(`${anno}/${String(anno + 1).slice(2)}`);
  const [inizio, setInizio] = useState(`${anno}-09-01`);
  const [fine, setFine] = useState(`${anno + 1}-06-30`);

  return (
    <Modulo
      titolo="Nuova stagione"
      sotto="Le date di norma vanno da settembre a giugno: servono a decidere a quale stagione appartiene ciò che si registra."
      etichettaInvia="Crea"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Dai un nome alla stagione.';
        if (inizio && fine && fine < inizio) return 'La fine non può venire prima dell’inizio.';
        await createSeason(state.teamProfile.id, { name: n, start_date: inizio || null, end_date: fine || null });
        onFatto();
      }}
    >
      <Campo etichetta="Nome"><Testo value={nome} onChange={e => setNome(e.target.value)} autoFocus /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Inizio"><Data value={inizio} onChange={e => setInizio(e.target.value)} /></Campo>
        <Campo etichetta="Fine"><Data value={fine} onChange={e => setFine(e.target.value)} /></Campo>
      </div>
    </Modulo>
  );
}

/* =========================================================== codice invito */
function CodiceInvito({ avvisa }) {
  const [rigenera, setRigenera] = useState(false);
  const [, ridisegna] = useState(0);
  const t = state.teamProfile || {};

  return (
    <div>
      <Etichetta className="mb-2.5">Codice società</Etichetta>
      <Pannello className="pad-pannello-stretto">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-[8rem] flex-1 select-all rounded-lg bg-pannello/12 px-3 py-2.5 font-mono text-[18px] font-bold tracking-[0.22em]">
            {t.invite_code || '—'}
          </code>
          <Pulsante
            className="py-2.5 text-[12px]"
            onClick={async () => {
              try { await navigator.clipboard.writeText(t.invite_code || ''); avvisa('Codice copiato'); }
              catch (e) { avvisa('Copialo a mano: ' + (t.invite_code || '')); }
            }}
          >
            Copia
          </Pulsante>
          <Pulsante variante="nudo" className="py-2.5 text-[12px]" onClick={() => setRigenera(true)}>
            Rigenera
          </Pulsante>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
          Vale per tutti e non scade: chi lo usa sceglie da sé se è atleta, genitore, scout o staff.
          Per far entrare una persona già col suo ruolo e le sue categorie, usa un invito da Utenti.
        </p>
      </Pannello>

      {rigenera && (
        <Conferma
          titolo="Rigenerare il codice?"
          testo="Il codice attuale smette di funzionare subito. Chi lo ha ricevuto e non l’ha ancora usato dovrà riceverne uno nuovo."
          etichetta="Rigenera"
          onChiudi={() => setRigenera(false)}
          onConferma={async () => {
            const nuovo = await regenerateInviteCode();
            state.teamProfile.invite_code = nuovo;
            ridisegna(n => n + 1);
            avvisa('Codice rigenerato');
          }}
        />
      )}
    </div>
  );
}
