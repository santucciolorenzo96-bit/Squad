import React, { useEffect, useRef, useState } from 'react';
import { state } from '../state.js';
import {
  fetchPlayer, updatePlayer, updateLinkedPlayerDetails, fetchPlayerDocuments,
  uploadPlayerDocument, getDocumentSignedUrl, reviewDocument,
  uploadPlayerPhoto, getPlayerPhotoSignedUrl
} from '../api/roster.js';
import { fetchDevelopment, saveDevelopment } from '../api/development.js';
import { DOC_TYPES, canReviewDocuments, isLinkedUser, canEditHome } from '../utils/permissions.js';
import { docStatus, DOC_STATE, ageFrom } from '../utils/docStatus.js';
import { resizeImageFile } from '../utils/image.js';
import { currentSport } from '../utils/sports/index.js';
import { computeSeasonStats, findSeasonRow } from '../utils/stats.js';
import { inCampione, DOCUMENTI_CAMPIONE } from './campione.js';
import { Pannello, Etichetta, Pulsante, Vuoto, Scheletro, Stato, Avatar, cx } from './ui.jsx';
import { Finestra, Modulo, Conferma, Campo, Testo, Data, Scelta, useAvviso } from './moduli.jsx';
import { ScegliCentro } from './ritaglio.jsx';
import { Chevron } from './icone.jsx';

/* La scheda di un atleta.
 *
 * Tutto quello che la società conserva su una persona, in un posto solo:
 * anagrafica, documenti, andamento. Prima erano tre punti diversi dell'app, e
 * per rispondere a "è a posto?" bisognava attraversarli tutti.
 *
 * Chi vede cosa non è un dettaglio:
 *   - la famiglia modifica i propri dati e carica i documenti, ma non li
 *     approva: approvare i propri documenti non vorrebbe dire niente;
 *   - lo staff approva e respinge, ed è l'unico a vedere la nota
 *     dell'allenatore;
 *   - il numero di maglia lo cambia solo chi gestisce la rosa.
 */

const TONO = {
  ok: 'buono', scadenza: 'attesa', verifica: 'attesa',
  scaduto: 'fermo', respinto: 'fermo', mancante: 'fermo'
};

const oggiISO = () => new Date().toISOString().slice(0, 10);

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function SchedaAtleta({ playerId, onChiudi }) {
  const sport = currentSport();
  const avvisa = useAvviso();

  const [p, setP] = useState(null);
  const [documenti, setDocumenti] = useState(null);
  const [foto, setFoto] = useState(null);
  const [sviluppo, setSviluppo] = useState(null);
  const [errore, setErrore] = useState(null);

  const [modAnagrafica, setModAnagrafica] = useState(false);
  const [carica, setCarica] = useState(null);     // { tipo }
  const [modSviluppo, setModSviluppo] = useState(false);
  const [centro, setCentro] = useState(null);     // { file }
  const inputFoto = useRef(null);

  const famiglia = isLinkedUser(state.currentUser);
  const puoiApprovare = canReviewDocuments(state.currentUser);
  const puoiVedereSviluppo = famiglia
    ? state.linkedPlayers.some(lp => lp.id === playerId)
    : canEditHome(state.currentUser);

  function carica_tutto() {
    if (inCampione()) {
      const base = state.roster.find(x => x.id === playerId);
      setP(base || null);
      setDocumenti((DOCUMENTI_CAMPIONE[playerId] || []).map((d, i) => ({
        ...d, id: playerId + '-' + i, file_path: null
      })));
      setSviluppo(null);
      return;
    }
    Promise.all([
      fetchPlayer(playerId),
      fetchPlayerDocuments(playerId).catch(() => []),
      fetchDevelopment(playerId).catch(() => null)
    ]).then(([giocatore, docs, dev]) => {
      setP(giocatore);
      setDocumenti(docs);
      setSviluppo(dev);
      if (giocatore && giocatore.photo_path) {
        getPlayerPhotoSignedUrl(giocatore.photo_path).then(setFoto).catch(() => {});
      }
    }).catch(setErrore);
  }
  useEffect(carica_tutto, [playerId]);

  if (errore) {
    return (
      <Finestra titolo="Scheda atleta" onChiudi={onChiudi}>
        <p className="text-[13px] text-rosso">{errore.message || String(errore)}</p>
      </Finestra>
    );
  }

  if (!p || documenti === null) {
    return (
      <Finestra titolo="Scheda atleta" onChiudi={onChiudi}>
        <Scheletro righe={4} />
      </Finestra>
    );
  }

  const oggi = oggiISO();
  const eta = ageFrom(p.birth_date, oggi);
  const stagione = computeSeasonStats(state.history, sport);
  const riga = findSeasonRow(stagione, p);

  async function scegliFoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (inCampione()) { avvisa('Nell’anteprima con dati di esempio non si carica niente.'); return; }
    try {
      // Ridotta prima di partire: una fotografia da telefono pesa cinque
      // megabyte, e in palestra la rete è quella che è.
      const ridotta = await resizeImageFile(file, 900);
      setCentro({ file: ridotta });
    } catch (err) {
      avvisa((err && err.message) || 'Immagine non leggibile.', 'errore');
    }
  }

  return (
    <>
      <Finestra
        titolo={p.name}
        sotto={`#${p.number}${p.role_position ? ' · ' + p.role_position : ''}${eta != null ? ' · ' + eta + ' anni' : ''}`}
        onChiudi={onChiudi}
        larga
      >
        {/* ------------------------------------------------------ ritratto */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => inputFoto.current && inputFoto.current.click()}
            className="relative shrink-0"
            title="Cambia fotografia"
          >
            <Avatar nome={p.name} url={foto} dim={72} />
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-blu to-blu2 text-[12px] text-white shadow-blu">
              ✎
            </span>
          </button>
          <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={scegliFoto} />

          <div className="min-w-0 flex-1">
            {riga && riga.games ? (
              <div className="flex gap-5">
                {sport.headline.map(h => (
                  <div key={h.key}>
                    <div className="text-[20px] font-bold leading-none">
                      {((riga[h.key] || 0) / riga.games).toFixed(1)}
                    </div>
                    <Etichetta className="mt-1.5">{h.label}</Etichetta>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-tenue">Nessuna partita giocata in questa stagione.</p>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------- anagrafica */}
        <div className="mt-6">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <Etichetta>Anagrafica</Etichetta>
            <Pulsante className="py-1 text-[11.5px]" onClick={() => setModAnagrafica(true)}>Modifica</Pulsante>
          </div>
          <Pannello className="overflow-hidden">
            {[
              ['Data di nascita', p.birth_date ? fmtData(p.birth_date) : '—'],
              ['Codice fiscale', p.fiscal_code || '—'],
              ['Telefono', p.guardian_phone || '—'],
              ['Email', p.email || '—'],
              ['Ruolo', p.role_position || '—'],
              ['Altezza', p.height_cm ? p.height_cm + ' cm' : '—']
            ].map(([k, v], i) => (
              <div key={k} className={cx('flex items-baseline gap-3 px-4 py-2.5', i > 0 && 'border-t border-bordo/6')}>
                <span className="w-32 shrink-0 text-[11.5px] text-tenue">{k}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{v}</span>
              </div>
            ))}
          </Pannello>
        </div>

        {/* ----------------------------------------------------- documenti */}
        <div className="mt-6">
          <Etichetta className="mb-2.5">Documenti</Etichetta>
          <div className="space-y-3">
            {DOC_TYPES.map(t => {
              const suoi = documenti.filter(d => d.doc_type === t.key)
                .sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
              const stato = docStatus(suoi, oggi);
              return (
                <Pannello key={t.key} className="pad-pannello-stretto">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold leading-tight">{t.label}</div>
                      {suoi[0] && suoi[0].expires_at && (
                        <div className="mt-1 text-[11.5px] text-tenue">
                          {suoi[0].expires_at < oggi ? 'scaduto il ' : 'valido fino al '}
                          {fmtData(suoi[0].expires_at)}
                        </div>
                      )}
                    </div>
                    <Stato tono={TONO[stato]}>{DOC_STATE[stato].label}</Stato>
                  </div>

                  {suoi.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {suoi.map(d => (
                        <RigaDocumento
                          key={d.id}
                          d={d}
                          puoiApprovare={puoiApprovare}
                          onAggiorna={carica_tutto}
                          avvisa={avvisa}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Pulsante className="py-1.5 text-[11.5px]" onClick={() => setCarica({ tipo: t })}>
                      Carica {suoi.length > 0 ? 'un nuovo file' : 'il documento'}
                    </Pulsante>
                  </div>
                </Pannello>
              );
            })}
          </div>
          {famiglia && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
              Dopo il caricamento il documento resta «in verifica» finché la società non lo
              approva: fino a quel momento non copre.
            </p>
          )}
        </div>

        {/* ------------------------------------------------ scheda evolutiva */}
        {puoiVedereSviluppo && (
          <div className="mt-6">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <Etichetta>Scheda evolutiva</Etichetta>
              {!famiglia && (
                <Pulsante className="py-1 text-[11.5px]" onClick={() => setModSviluppo(true)}>Modifica</Pulsante>
              )}
            </div>
            <Pannello className="pad-pannello-stretto">
              {sviluppo && (sviluppo.objective || sviluppo.coach_note) ? (
                <>
                  {sviluppo.objective && (
                    <div>
                      <Etichetta>Obiettivo</Etichetta>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed">{sviluppo.objective}</p>
                      {sviluppo.objective_set_at && (
                        <p className="mt-1 text-[11px] text-tenue">
                          fissato il {fmtData(sviluppo.objective_set_at)}
                        </p>
                      )}
                    </div>
                  )}
                  {/* La nota dell'allenatore non la vede la famiglia: è uno
                      strumento di lavoro fra tecnici, e saperla letta la
                      renderebbe diplomatica invece che utile. */}
                  {sviluppo.coach_note && !famiglia && (
                    <div className={cx(sviluppo.objective && 'mt-4 border-t border-bordo/8 pt-4')}>
                      <Etichetta>Nota dell’allenatore</Etichetta>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-soffuso">{sviluppo.coach_note}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-tenue">
                  {famiglia
                    ? 'L’allenatore non ha ancora fissato un obiettivo.'
                    : 'Nessun obiettivo fissato. Un obiettivo scritto è quello di cui si parla al colloquio con la famiglia.'}
                </p>
              )}
            </Pannello>
          </div>
        )}
      </Finestra>

      {modAnagrafica && (
        <ModuloAnagrafica
          p={p}
          famiglia={famiglia}
          sport={sport}
          onChiudi={() => setModAnagrafica(false)}
          onFatto={() => { carica_tutto(); avvisa('Scheda salvata'); }}
        />
      )}

      {carica && (
        <ModuloCaricamento
          p={p}
          tipo={carica.tipo}
          onChiudi={() => setCarica(null)}
          onFatto={() => { carica_tutto(); avvisa('Documento caricato: resta in verifica finché non viene approvato.'); }}
        />
      )}

      {modSviluppo && (
        <ModuloSviluppo
          p={p}
          sviluppo={sviluppo}
          onChiudi={() => setModSviluppo(false)}
          onFatto={() => { carica_tutto(); avvisa('Scheda evolutiva salvata'); }}
        />
      )}

      {centro && (
        <ScegliCentro
          file={centro.file}
          onChiudi={() => setCentro(null)}
          onConferma={async (punto) => {
            try {
              const agg = await uploadPlayerPhoto(state.teamProfile.id, p.id, centro.file);
              await updatePlayer(p.id, { photo_focal_x: punto.x, photo_focal_y: punto.y });
              setCentro(null);
              carica_tutto();
              avvisa('Fotografia aggiornata');
            } catch (e) {
              console.error(e);
              avvisa((e && e.message) || 'Caricamento non riuscito.', 'errore');
            }
          }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------- riga documento */
function RigaDocumento({ d, puoiApprovare, onAggiorna, avvisa }) {
  const [respingi, setRespingi] = useState(false);
  const [lavora, setLavora] = useState(false);

  const ETICHETTE = { approved: 'Approvato', in_review: 'In verifica', rejected: 'Respinto' };
  const TONI = { approved: 'buono', in_review: 'attesa', rejected: 'fermo' };

  async function apri() {
    try {
      const url = await getDocumentSignedUrl(d.file_path);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      avvisa((e && e.message) || 'Non è stato possibile aprire il file.', 'errore');
    }
  }

  async function decidi(stato, nota) {
    setLavora(true);
    try {
      await reviewDocument(d.id, stato, state.currentUser.id, nota || null);
      onAggiorna();
      avvisa(stato === 'approved' ? 'Documento approvato' : 'Documento respinto');
    } catch (e) {
      avvisa((e && e.message) || 'Operazione non riuscita.', 'errore');
    } finally {
      setLavora(false);
    }
  }

  return (
    <>
      <div className="rounded-lg bg-pannello/6 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px]">
              caricato il {new Date(d.uploaded_at).toLocaleDateString('it-IT')}
            </div>
            {d.review_note && (
              <div className="mt-1 text-[11.5px] leading-snug text-rosso">{d.review_note}</div>
            )}
          </div>
          <Stato tono={TONI[d.status] || 'neutro'}>{ETICHETTE[d.status] || d.status}</Stato>
          <button
            onClick={apri}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue hover:text-testo"
          >
            Apri
          </button>
        </div>

        {/* Le due decisioni sono affiancate e distinte per colore, ma nessuna
            delle due è il pulsante grande: approvare un certificato senza
            averlo aperto è la cosa da non rendere comoda. */}
        {puoiApprovare && d.status === 'in_review' && (
          <div className="mt-2.5 flex gap-2 border-t border-bordo/8 pt-2.5">
            <button
              onClick={() => decidi('approved')}
              disabled={lavora}
              className="flex-1 rounded-lg bg-verde/14 py-2 text-[12px] font-semibold text-verde transition-all hover:bg-verde/22 disabled:opacity-40"
            >
              Approva
            </button>
            <button
              onClick={() => setRespingi(true)}
              disabled={lavora}
              className="flex-1 rounded-lg bg-rosso/12 py-2 text-[12px] font-semibold text-rosso transition-all hover:bg-rosso/20 disabled:opacity-40"
            >
              Respingi
            </button>
          </div>
        )}
      </div>

      {respingi && (
        <ModuloRespingi
          onChiudi={() => setRespingi(false)}
          onConferma={(nota) => decidi('rejected', nota)}
        />
      )}
    </>
  );
}

function ModuloRespingi({ onChiudi, onConferma }) {
  const [nota, setNota] = useState('');
  return (
    <Modulo
      titolo="Respingere il documento?"
      sotto="La famiglia lo vede respinto e deve caricarne un altro."
      etichettaInvia="Respingi"
      onChiudi={onChiudi}
      onInvia={async () => {
        // Il motivo non è facoltativo: un documento respinto senza spiegazione
        // viene ricaricato identico, e si ricomincia da capo.
        if (!nota.trim()) return 'Scrivi perché lo respingi: senza motivo verrà ricaricato uguale.';
        await onConferma(nota.trim());
        onChiudi();
      }}
    >
      <Campo etichetta="Motivo">
        <Testo
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Es. la data di scadenza non si legge"
          autoFocus
        />
      </Campo>
    </Modulo>
  );
}

/* ------------------------------------------------------------ caricamento */
function ModuloCaricamento({ p, tipo, onChiudi, onFatto }) {
  const [file, setFile] = useState(null);
  const [scadenza, setScadenza] = useState('');
  const input = useRef(null);

  const certificato = tipo.key === 'certificato_medico';

  return (
    <Modulo
      titolo={'Carica: ' + tipo.label}
      sotto={`Per ${p.name}. Va bene una fotografia leggibile o un PDF.`}
      etichettaInvia="Carica"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!file) return 'Scegli un file.';
        if (certificato && !scadenza) {
          // Senza scadenza un certificato non può scadere, e Situazione non
          // può avvisare nessuno: è il dato che rende utile tutto il resto.
          return 'Serve la data di scadenza: è quella che fa scattare l’avviso quando si avvicina.';
        }
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si carica niente.';

        let daInviare = file;
        // Le fotografie si riducono, i PDF no: un PDF ridimensionato non
        // esiste, e passarlo per un canvas lo distruggerebbe.
        if (file.type && file.type.startsWith('image/')) {
          daInviare = await resizeImageFile(file, 1600);
        }
        const est = (file.name.split('.').pop() || 'jpg').toLowerCase();
        await uploadPlayerDocument(
          state.teamProfile.id, p.id, tipo.key, daInviare, est,
          state.currentUser.id, scadenza || null
        );
        onFatto();
      }}
    >
      <Campo etichetta="File">
        <button
          type="button"
          onClick={() => input.current && input.current.click()}
          className={cx(
            'flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-left transition-colors',
            file ? 'border-blu/40 bg-blu/6' : 'border-bordo/20 hover:border-bordo/35'
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-pannello/12 text-[17px]">
            {file ? '✓' : '+'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">
              {file ? file.name : 'Scegli una fotografia o un PDF'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-tenue">
              {file
                ? Math.round(file.size / 1024) + ' KB'
                : 'Dalla fotocamera va benissimo, basta che si legga'}
            </span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => setFile(e.target.files && e.target.files[0])}
        />
      </Campo>

      <Campo
        etichetta={'Scadenza' + (certificato ? '' : ' (facoltativa)')}
        aiuto={certificato
          ? 'È la data scritta sul certificato. Da lì partono gli avvisi trenta giorni prima.'
          : 'Se il documento non scade, lascia vuoto.'}
      >
        <Data value={scadenza} onChange={e => setScadenza(e.target.value)} />
      </Campo>
    </Modulo>
  );
}

/* ------------------------------------------------------------- anagrafica */
function ModuloAnagrafica({ p, famiglia, sport, onChiudi, onFatto }) {
  const [nome, setNome] = useState(p.name || '');
  const [numero, setNumero] = useState(p.number || '');
  const [nascita, setNascita] = useState(p.birth_date || '');
  const [cf, setCf] = useState(p.fiscal_code || '');
  const [tel, setTel] = useState(p.guardian_phone || '');
  const [email, setEmail] = useState(p.email || '');
  const [ruolo, setRuolo] = useState(p.role_position || '');
  const [altezza, setAltezza] = useState(p.height_cm ? String(p.height_cm) : '');

  return (
    <Modulo
      titolo="Modifica la scheda"
      sotto={famiglia ? 'Nome e numero di maglia li cambia la società.' : null}
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!famiglia && !nome.trim()) return 'Il nome non può restare vuoto.';
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';
        const comuni = {
          birth_date: nascita || null,
          fiscal_code: cf.trim().toUpperCase() || null,
          guardian_phone: tel.trim() || null,
          email: email.trim() || null,
          height_cm: altezza ? parseInt(altezza, 10) : null
        };
        if (famiglia) {
          // La famiglia passa da una funzione che scrive SOLO queste colonne:
          // le policy sono per riga, non per colonna, e senza di essa un
          // genitore potrebbe cambiarsi il numero di maglia o il nome.
          await updateLinkedPlayerDetails(p.id, comuni);
        } else {
          await updatePlayer(p.id, {
            ...comuni,
            name: nome.trim(),
            number: numero.trim() || '-',
            role_position: ruolo.trim() || null
          });
        }
        onFatto();
      }}
    >
      {!famiglia && (
        <div className="grid grid-cols-[5.5rem_1fr] gap-3">
          <Campo etichetta="Numero"><Testo value={numero} onChange={e => setNumero(e.target.value)} maxLength={3} /></Campo>
          <Campo etichetta="Nome e cognome"><Testo value={nome} onChange={e => setNome(e.target.value)} /></Campo>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Data di nascita"><Data value={nascita} onChange={e => setNascita(e.target.value)} /></Campo>
        <Campo etichetta="Codice fiscale">
          <Testo value={cf} onChange={e => setCf(e.target.value.toUpperCase())} maxLength={16} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Telefono" aiuto="Di chi contattare per l’atleta.">
          <Testo value={tel} onChange={e => setTel(e.target.value)} inputMode="tel" />
        </Campo>
        <Campo etichetta="Email"><Testo type="email" value={email} onChange={e => setEmail(e.target.value)} inputMode="email" /></Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!famiglia && (
          <Campo etichetta="Ruolo">
            <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
              <option value="">— nessuno —</option>
              {(sport.positions || []).map(r => <option key={r} value={r}>{r}</option>)}
            </Scelta>
          </Campo>
        )}
        <Campo etichetta="Altezza (cm)">
          <Testo
            inputMode="numeric"
            value={altezza}
            onChange={e => setAltezza(e.target.value.replace(/\D/g, ''))}
            maxLength={3}
          />
        </Campo>
      </div>
    </Modulo>
  );
}

/* -------------------------------------------------------- scheda evolutiva */
function ModuloSviluppo({ p, sviluppo, onChiudi, onFatto }) {
  const [obiettivo, setObiettivo] = useState((sviluppo && sviluppo.objective) || '');
  const [nota, setNota] = useState((sviluppo && sviluppo.coach_note) || '');
  const originale = (sviluppo && sviluppo.objective) || '';

  return (
    <Modulo
      titolo="Scheda evolutiva"
      sotto={p.name}
      onChiudi={onChiudi}
      onInvia={async () => {
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';
        await saveDevelopment(state.teamProfile.id, p.id, {
          objective: obiettivo.trim() || null,
          coach_note: nota.trim() || null,
          // La data dell'obiettivo si aggiorna solo se l'obiettivo cambia
          // davvero: altrimenti "fissato il ..." diventerebbe la data
          // dell'ultimo salvataggio, che non dice niente.
          objective_changed: obiettivo.trim() !== originale.trim(),
          updated_by: state.currentUser.id
        });
        onFatto();
      }}
    >
      <Campo
        etichetta="Obiettivo"
        aiuto="Lo vede anche la famiglia. È quello di cui si parla al colloquio, quindi conviene sia una cosa sola e verificabile."
      >
        <Testo
          value={obiettivo}
          onChange={e => setObiettivo(e.target.value)}
          placeholder="Es. tiro in sospensione dai 4 metri"
          autoFocus
        />
      </Campo>

      <Campo
        etichetta="Nota dell’allenatore"
        aiuto="Questa NON la vede la famiglia: è uno strumento di lavoro fra tecnici."
      >
        <Testo
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Es. cala di concentrazione nell'ultimo quarto"
        />
      </Campo>
    </Modulo>
  );
}
