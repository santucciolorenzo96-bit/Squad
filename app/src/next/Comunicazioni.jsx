import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import {
  fetchCommunications, fetchMyCommunications, createCommunication,
  closeCommunication, removeCommunication, respondToCommunication
} from '../api/communications.js';
import { canEditHome, isLinkedUser } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, Avatar, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Data, Scelta, Spunta, ErroreCaricamento, useAvviso } from './moduli.jsx';
import { IconaSezione } from './icone.jsx';

/* Comunicazioni.
 *
 * Due schermate diverse dietro lo stesso nome, ed è giusto così: chi convoca
 * vuole sapere chi ha risposto, chi è convocato vuole rispondere. Mostrare a
 * un genitore la tabella delle risposte di tutti sarebbe anche una fuga di
 * dati altrui.
 */

const TIPI = { convocazione: 'Convocazione', trasferta: 'Trasferta', avviso: 'Avviso' };
const RISPOSTE = {
  confirmed: { label: 'Presente', tono: 'buono' },
  declined: { label: 'Assente', tono: 'fermo' },
  pending: { label: 'In attesa', tono: 'attesa' }
};

const oggiISO = () => new Date().toISOString().slice(0, 10);

function fmtGiorno(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function Comunicazioni() {
  return isLinkedUser(state.currentUser) ? <VistaFamiglia /> : <VistaStaff />;
}

/* ============================================================ vista famiglia */
function VistaFamiglia() {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const ids = state.linkedPlayers.map(p => p.id);

  useEffect(() => {
    let vivo = true;
    if (inCampione() || ids.length === 0) { setDati([]); return; }
    fetchMyCommunications(ids)
      .then(d => { if (vivo) setDati(d); })
      .catch(e => { if (vivo) setErrore(e); });
    return () => { vivo = false; };
  }, []);

  if (errore) return <ErroreCaricamento cosa="le comunicazioni" errore={errore} />;
  if (!dati) return <><Titolo sopra="Categoria">Comunicazioni</Titolo><Scheletro righe={3} /></>;

  // Le più recenti in cima, e quelle a cui manca la risposta ancora più su:
  // sono l'unica cosa che chiede di fare qualcosa.
  const righe = dati.slice().sort((a, b) => {
    const aDa = a.status === 'pending' ? 0 : 1;
    const bDa = b.status === 'pending' ? 0 : 1;
    if (aDa !== bDa) return aDa - bDa;
    return String((b.communications || {}).event_date || '').localeCompare(String((a.communications || {}).event_date || ''));
  });

  return (
    <div className="sezioni">
      <Titolo sopra="Le tue">Comunicazioni</Titolo>

      {righe.length === 0 ? (
        <Vuoto>Nessuna comunicazione. Quando la società convoca o avvisa, compare qui.</Vuoto>
      ) : (
        <div className="space-y-3">
          {righe.map(r => {
            const c = r.communications || {};
            const atleta = state.linkedPlayers.find(p => p.id === r.player_id);
            const passata = c.event_date && c.event_date < oggiISO();
            const chiede = c.requires_response && !passata;
            return (
              <Pannello key={c.id + r.player_id} className="pad-pannello-stretto">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Etichetta>{TIPI[c.kind] || c.kind}{atleta ? ' · ' + atleta.name : ''}</Etichetta>
                    <h3 className="mt-1.5 text-[16px] font-bold leading-tight">{c.title}</h3>
                  </div>
                  {c.requires_response && (
                    <Stato tono={(RISPOSTE[r.status] || RISPOSTE.pending).tono}>
                      {(RISPOSTE[r.status] || RISPOSTE.pending).label}
                    </Stato>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-[12.5px] text-soffuso">
                  {c.event_date && <div>{fmtGiorno(c.event_date)}</div>}
                  {(c.meet_time || c.start_time) && (
                    <div>
                      {c.meet_time && <>ritrovo <b className="text-testo">{c.meet_time}</b></>}
                      {c.meet_time && c.start_time && ' · '}
                      {c.start_time && <>inizio <b className="text-testo">{c.start_time}</b></>}
                    </div>
                  )}
                  {c.location && <div className="font-semibold text-testo">{c.location}</div>}
                  {c.body && <p className="pt-1 leading-relaxed">{c.body}</p>}
                </div>

                {chiede && (
                  <div className="mt-4 flex gap-2">
                    {['confirmed', 'declined'].map(s => (
                      <Pulsante
                        key={s}
                        variante={r.status === s ? 'primario' : 'vetro'}
                        className="flex-1"
                        onClick={async () => {
                          try {
                            await respondToCommunication(c.id, r.player_id, s, null);
                            r.status = s;
                            ridisegna(n => n + 1);
                            avvisa(s === 'confirmed' ? 'Hai confermato la presenza' : 'Hai segnalato l’assenza');
                          } catch (e) {
                            console.error(e);
                            avvisa((e && e.message) || 'Non è stato possibile rispondere.', 'errore');
                          }
                        }}
                      >
                        {RISPOSTE[s].label}
                      </Pulsante>
                    ))}
                  </div>
                )}
                {c.requires_response && c.respond_by && r.status === 'pending' && !passata && (
                  <p className="mt-2 text-[11.5px] text-ambra">
                    Rispondi entro il {new Date(c.respond_by + 'T00:00:00').toLocaleDateString('it-IT')}
                  </p>
                )}
              </Pannello>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =============================================================== vista staff */
function VistaStaff() {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [nuova, setNuova] = useState(false);
  const [aperta, setAperta] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiScrivere = canEditHome(state.currentUser);

  function carica() {
    if (inCampione()) { setDati([]); return; }
    setDati(null);
    fetchCommunications(state.activeSectorId)
      .then(setDati)
      .catch(setErrore);
  }
  useEffect(carica, [state.activeSectorId]);

  if (errore) return <ErroreCaricamento cosa="le comunicazioni" errore={errore} onRiprova={carica} />;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={puoiScrivere
          ? <Pulsante variante="primario" onClick={() => setNuova(true)}>+ Comunicazione</Pulsante>
          : null}
      >
        Comunicazioni
      </Titolo>

      {!dati ? (
        <Scheletro righe={3} />
      ) : dati.length === 0 ? (
        <Vuoto>
          Nessuna comunicazione inviata in questa categoria. Una convocazione arriva a tutti i
          convocati e tiene il conto di chi ha risposto.
        </Vuoto>
      ) : (
        <div className="space-y-3">
          {dati.map(c => {
            const dest = c.communication_recipients || [];
            const conf = dest.filter(d => d.status === 'confirmed').length;
            const rif = dest.filter(d => d.status === 'declined').length;
            const attesa = dest.filter(d => d.status === 'pending').length;
            const passata = c.event_date && c.event_date < oggiISO();
            return (
              <Pannello key={c.id} className="pad-pannello-stretto">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setAperta(c)} className="min-w-0 text-left">
                    <Etichetta>{TIPI[c.kind] || c.kind}</Etichetta>
                    <h3 className="mt-1.5 text-[16px] font-bold leading-tight">{c.title}</h3>
                    <div className="mt-1 text-[12.5px] text-tenue">
                      {c.event_date ? fmtGiorno(c.event_date) : 'Senza data'}
                      {c.location && ' · ' + c.location}
                    </div>
                  </button>
                  {c.closed_at && <Stato>Chiusa</Stato>}
                </div>

                {c.requires_response && (
                  <button
                    onClick={() => setAperta(c)}
                    className="mt-3 flex w-full items-center gap-4 rounded-lg bg-pannello/8 px-3.5 py-2.5 text-left"
                  >
                    <span className="text-[13px]">
                      <b className="text-verde">{conf}</b> <span className="text-tenue">sì</span>
                    </span>
                    <span className="text-[13px]">
                      <b className="text-rosso">{rif}</b> <span className="text-tenue">no</span>
                    </span>
                    <span className="text-[13px]">
                      <b className={attesa && !passata ? 'text-ambra' : 'text-tenue'}>{attesa}</b>{' '}
                      <span className="text-tenue">in attesa</span>
                    </span>
                    <span className="ml-auto text-[11.5px] text-tenue">dettaglio ›</span>
                  </button>
                )}

                {puoiScrivere && (
                  <div className="mt-3 flex justify-end gap-2">
                    {!c.closed_at && (
                      <Pulsante
                        variante="nudo"
                        className="py-1.5 text-[11.5px]"
                        onClick={async () => {
                          try {
                            await closeCommunication(c.id);
                            c.closed_at = new Date().toISOString();
                            ridisegna(n => n + 1);
                            avvisa('Comunicazione chiusa');
                          } catch (e) {
                            avvisa((e && e.message) || 'Non riuscita.', 'errore');
                          }
                        }}
                      >
                        Chiudi
                      </Pulsante>
                    )}
                    <Pulsante variante="nudo" className="py-1.5 text-[11.5px]" onClick={() => setDaRimuovere(c)}>
                      Elimina
                    </Pulsante>
                  </div>
                )}
              </Pannello>
            );
          })}
        </div>
      )}

      {nuova && (
        <ModuloComunicazione
          onChiudi={() => setNuova(false)}
          onFatto={() => { carica(); avvisa('Comunicazione inviata'); }}
        />
      )}

      {aperta && <DettaglioRisposte c={aperta} onChiudi={() => setAperta(null)} />}

      {daRimuovere && (
        <Conferma
          titolo="Eliminare la comunicazione?"
          testo={`«${daRimuovere.title}» e tutte le risposte ricevute vengono cancellate.`}
          etichetta="Elimina"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removeCommunication(daRimuovere.id);
            setDati(d => d.filter(x => x.id !== daRimuovere.id));
            avvisa('Comunicazione eliminata');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- le risposte */
function DettaglioRisposte({ c, onChiudi }) {
  const dest = c.communication_recipients || [];
  // In attesa per primi: sono quelli da richiamare, ed è la ragione per cui si
  // apre questa finestra.
  const righe = dest.map(d => ({
    d, p: state.roster.find(p => p.id === d.player_id)
  })).sort((a, b) => {
    const ord = { pending: 0, declined: 1, confirmed: 2 };
    const da = ord[a.d.status] ?? 0, db = ord[b.d.status] ?? 0;
    if (da !== db) return da - db;
    return ((a.p && a.p.name) || '').localeCompare((b.p && b.p.name) || '');
  });

  return (
    <Modulo
      titolo={c.title}
      sotto={`${TIPI[c.kind] || c.kind}${c.event_date ? ' · ' + fmtGiorno(c.event_date) : ''}`}
      onChiudi={onChiudi}
      onInvia={onChiudi}
      etichettaInvia="Chiudi"
    >
      {righe.length === 0 ? (
        <p className="text-[13px] text-tenue">Nessun destinatario.</p>
      ) : (
        <div className="-mx-1">
          {righe.map(({ d, p }) => (
            <div key={d.player_id} className="flex items-center gap-3 border-b border-bordo/6 px-1 py-2.5 last:border-b-0">
              <Avatar nome={p ? p.name : '?'} dim={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{p ? p.name : 'Giocatore rimosso'}</div>
                {d.note && <div className="text-[11.5px] text-tenue">{d.note}</div>}
              </div>
              <Stato tono={(RISPOSTE[d.status] || RISPOSTE.pending).tono}>
                {(RISPOSTE[d.status] || RISPOSTE.pending).label}
              </Stato>
            </div>
          ))}
        </div>
      )}
    </Modulo>
  );
}

/* -------------------------------------------------------------- nuova comm. */
function ModuloComunicazione({ onChiudi, onFatto }) {
  const prossime = [...state.calendar]
    .filter(m => !m.played && (!m.date || m.date >= oggiISO()))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .slice(0, 6);

  const [tipo, setTipo] = useState('convocazione');
  const [partita, setPartita] = useState(prossime.length ? '0' : '');
  const [titolo, setTitolo] = useState('');
  const [titoloAMano, setTitoloAMano] = useState(false);
  const [data, setData] = useState('');
  const [ritrovo, setRitrovo] = useState('');
  const [inizio, setInizio] = useState('');
  const [luogo, setLuogo] = useState('');
  const [note, setNote] = useState('');
  const [chiedi, setChiedi] = useState(true);
  const [entro, setEntro] = useState('');
  const [scelti, setScelti] = useState(() => state.roster.map(p => p.id));

  const settore = (state.sectors.find(s => s.id === state.activeSectorId) || {}).name || '';

  // La prossima partita è la convocazione che si sta scrivendo nove volte su
  // dieci: arriva già compilata, e resta cambiabile.
  function applica(m) {
    if (!m) return;
    if (!titoloAMano) {
      setTitolo(`${settore} — ${m.home === false ? 'trasferta con' : 'partita con'} ${m.opponent}`);
    }
    setData(m.date || '');
    setInizio(m.time || '');
    setLuogo(m.location || '');
    setTipo(m.home === false ? 'trasferta' : 'convocazione');
  }
  useEffect(() => { if (prossime.length) applica(prossime[0]); }, []);

  return (
    <Modulo
      titolo="Nuova comunicazione"
      onChiudi={onChiudi}
      etichettaInvia="Invia"
      larga
      onInvia={async () => {
        const t = titolo.trim();
        if (!t) return 'Scrivi un titolo.';
        if (scelti.length === 0) return 'Seleziona almeno un destinatario.';
        await createCommunication(state.teamProfile.id, state.activeSectorId, {
          kind: tipo,
          title: t,
          body: note.trim() || null,
          event_date: data || null,
          meet_time: ritrovo.trim() || null,
          start_time: inizio.trim() || null,
          location: luogo.trim() || null,
          requires_response: chiedi,
          respond_by: entro || null
        }, scelti, state.currentUser.id);
        onFatto();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Tipo">
          <Scelta value={tipo} onChange={e => setTipo(e.target.value)}>
            {Object.entries(TIPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Scelta>
        </Campo>

        {prossime.length > 0 && (
          <Campo etichetta="Riferita a una partita">
            <Scelta
              value={partita}
              onChange={e => { setPartita(e.target.value); applica(prossime[parseInt(e.target.value, 10)]); }}
            >
              {prossime.map((m, i) => (
                <option key={m.id} value={String(i)}>
                  {m.opponent}{m.date ? ' · ' + new Date(m.date + 'T00:00:00').toLocaleDateString('it-IT') : ''}
                </option>
              ))}
              <option value="">— nessuna partita —</option>
            </Scelta>
          </Campo>
        )}
      </div>

      <Campo etichetta="Titolo">
        <Testo
          value={titolo}
          onChange={e => { setTitolo(e.target.value); setTitoloAMano(true); }}
          placeholder="Es. U15 — partita con Rookies"
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etichetta="Data"><Data value={data} onChange={e => setData(e.target.value)} /></Campo>
        <Campo etichetta="Ritrovo"><Testo value={ritrovo} onChange={e => setRitrovo(e.target.value)} placeholder="14:00" /></Campo>
        <Campo etichetta="Inizio"><Testo value={inizio} onChange={e => setInizio(e.target.value)} placeholder="15:00" /></Campo>
      </div>

      <Campo etichetta="Luogo">
        <Testo value={luogo} onChange={e => setLuogo(e.target.value)} placeholder="Palestra Comunale" />
      </Campo>
      <Campo etichetta="Note" aiuto="Facoltative">
        <Testo value={note} onChange={e => setNote(e.target.value)} placeholder="Portare la divisa bianca" />
      </Campo>

      <div className="space-y-3 rounded-lg bg-pannello/8 px-3.5 py-3">
        <Spunta
          checked={chiedi}
          onChange={e => setChiedi(e.target.checked)}
          etichetta="Chiedi conferma alle famiglie"
        />
        {chiedi && (
          <Campo etichetta="Rispondere entro" aiuto="Facoltativo: serve solo a ricordarlo nella comunicazione.">
            <Data value={entro} onChange={e => setEntro(e.target.value)} />
          </Campo>
        )}
      </div>

      <Campo etichetta={`Destinatari (${scelti.length} di ${state.roster.length})`}>
        <div className="mb-2 flex justify-end">
          <Pulsante
            variante="nudo"
            className="py-1 text-[11.5px]"
            onClick={() => setScelti(s => (s.length === state.roster.length ? [] : state.roster.map(p => p.id)))}
          >
            {scelti.length === state.roster.length ? 'Nessuno' : 'Tutti'}
          </Pulsante>
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg bg-pannello/6 px-3 py-2.5">
          {state.roster.map(p => (
            <Spunta
              key={p.id}
              checked={scelti.includes(p.id)}
              onChange={e => setScelti(s => (e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id)))}
              etichetta={<span><span className="text-tenue">#{p.number}</span> {p.name}</span>}
            />
          ))}
        </div>
      </Campo>
    </Modulo>
  );
}
