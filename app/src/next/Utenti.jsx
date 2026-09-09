import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import {
  ROLES, ASSIGNABLE_ROLES, ADMIN_ROLES, LINKED_ROLES,
  isFinanceAdmin, isAdmin, roleLabel
} from '../utils/permissions.js';
import { updateProfile, deactivateProfile } from '../api/profiles.js';
import { assignStaffToSector, removeStaffFromSector, fetchStaffSectors } from '../api/sectors.js';
import { fetchFamilyLinksForTeam, linkProfileToPlayer, unlinkProfileFromPlayer } from '../api/family.js';
import { fetchInvites, createInvite, revokeInvite } from '../api/invites.js';
import { orderedSectors } from '../utils/sectors.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, Avatar, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, Scelta, Spunta, ErroreCaricamento, useAvviso } from './moduli.jsx';

/* Utenti.
 *
 * Tre cose, in quest'ordine: chi puoi ancora far entrare (gli inviti), chi
 * lavora nella società (lo staff), chi è collegato a un atleta (le famiglie).
 * Gli inviti stanno per primi perché sono l'unica parte che chiede di fare
 * qualcosa: le altre due si consultano.
 */

const TONO_RUOLO = {
  admin: 'text-rosa', presidente: 'text-rosa',
  allenatore: 'text-verde', staff: 'text-ciano',
  segnapunti: 'text-ambra', genitore: 'text-viola', atleta: 'text-viola'
};

function fmtData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function Utenti() {
  const avvisa = useAvviso();
  return (
    <div className="sezioni">
      <Titolo sopra="Società">Utenti</Titolo>

      <Pannello className="pad-pannello-stretto">
        <Etichetta>Due modi per far entrare qualcuno</Etichetta>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-soffuso">
          Il <b className="text-testo">codice società</b> (in Squadra) vale per tutti e non scade: chi lo usa
          sceglie da sé se è atleta, genitore, scout o staff, e poi ruolo, categorie e collegamenti li sistemi
          qui a mano. Un <b className="text-testo">invito</b> vale per una persona sola, una volta sola, e porta
          già con sé quelle scelte.
        </p>
      </Pannello>

      <Inviti avvisa={avvisa} />
      <Staff avvisa={avvisa} />
      <Famiglie avvisa={avvisa} />
    </div>
  );
}

/* ================================================================== inviti */
function statoInvito(inv) {
  if (inv.used_at) return { key: 'usato', label: 'Usato', tono: 'buono' };
  if (inv.revoked_at) return { key: 'revocato', label: 'Revocato', tono: 'fermo' };
  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) return { key: 'scaduto', label: 'Scaduto', tono: 'fermo' };
  return { key: 'valido', label: 'Valido', tono: 'attesa' };
}

function Inviti({ avvisa }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [nuovo, setNuovo] = useState(false);
  const [daRevocare, setDaRevocare] = useState(null);
  const [storico, setStorico] = useState(false);

  function carica() {
    if (inCampione() || !isAdmin(state.currentUser)) { setDati([]); return; }
    setDati(null);
    fetchInvites().then(setDati).catch(setErrore);
  }
  useEffect(carica, []);

  if (!isAdmin(state.currentUser)) return null;
  if (errore) return <ErroreCaricamento cosa="gli inviti" errore={errore} onRiprova={carica} />;

  const tutti = dati || [];
  const attivi = tutti.filter(i => statoInvito(i).key === 'valido');
  const chiusi = tutti.filter(i => statoInvito(i).key !== 'valido');

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Etichetta>Inviti</Etichetta>
        <Pulsante variante="primario" className="py-1.5 text-[11.5px]" onClick={() => setNuovo(true)}>
          + Invita una persona
        </Pulsante>
      </div>

      {!dati ? (
        <Scheletro righe={2} />
      ) : attivi.length === 0 ? (
        <Vuoto>Nessun invito in attesa.</Vuoto>
      ) : (
        <div className="space-y-2.5">
          {attivi.map(i => <RigaInvito key={i.id} inv={i} onRevoca={() => setDaRevocare(i)} avvisa={avvisa} />)}
        </div>
      )}

      {chiusi.length > 0 && (
        <>
          <button
            onClick={() => setStorico(s => !s)}
            className="mt-3 w-full rounded-lg vetro orlo py-2 text-[12px] font-semibold text-tenue hover:text-testo"
          >
            {storico ? 'Nascondi gli inviti passati' : `Inviti passati (${chiusi.length})`}
          </button>
          {storico && (
            <div className="mt-2.5 space-y-2.5">
              {chiusi.map(i => <RigaInvito key={i.id} inv={i} avvisa={avvisa} />)}
            </div>
          )}
        </>
      )}

      {nuovo && (
        <ModuloInvito
          onChiudi={() => setNuovo(false)}
          onFatto={(codice) => { carica(); avvisa('Invito creato: ' + codice); }}
        />
      )}

      {daRevocare && (
        <Conferma
          titolo="Revocare l’invito?"
          testo={`Il codice ${daRevocare.code} smetterà di funzionare. Chi l’ha ricevuto non potrà più usarlo.`}
          etichetta="Revoca"
          onChiudi={() => setDaRevocare(null)}
          onConferma={async () => { await revokeInvite(daRevocare.id); carica(); avvisa('Invito revocato'); }}
        />
      )}
    </div>
  );
}

function RigaInvito({ inv, onRevoca, avvisa }) {
  const st = statoInvito(inv);
  const settori = (inv.sector_ids || [])
    .map(id => (state.sectors.find(s => s.id === id) || {}).name).filter(Boolean);

  return (
    <Pannello className="pad-pannello-stretto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{inv.label || ROLES[inv.role] || inv.role}</div>
          <div className="mt-1 text-[12px] text-tenue">
            <span className={cx('font-semibold', TONO_RUOLO[inv.role] || '')}>{ROLES[inv.role] || inv.role}</span>
            {settori.length > 0 && ' · ' + settori.join(', ')}
            {inv.players && ' · collegato a ' + inv.players.name}
          </div>
        </div>
        <Stato tono={st.tono}>{st.label}</Stato>
      </div>

      {st.key === 'valido' ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Il codice si detta al telefono più spesso di quanto si copi:
                spaziato e monospaziato, selezionabile con un colpo solo. */}
            <code className="min-w-[9rem] flex-1 select-all rounded-lg bg-pannello/12 px-3 py-2 font-mono text-[15px] font-bold tracking-[0.18em]">
              {inv.code}
            </code>
            <Pulsante
              className="py-2 text-[11.5px]"
              onClick={async () => {
                try { await navigator.clipboard.writeText(inv.code); avvisa('Codice copiato'); }
                catch (e) { avvisa('Copialo a mano: ' + inv.code); }
              }}
            >
              Copia
            </Pulsante>
            {onRevoca && (
              <button
                onClick={onRevoca}
                title="Revoca"
                className="rounded-lg px-2.5 py-2 text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
              >
                ✕
              </button>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-tenue">
            {inv.expires_at ? 'Scade il ' + fmtData(inv.expires_at) : 'Senza scadenza'}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[11.5px] text-tenue">
          {inv.used_at
            ? 'Usato il ' + fmtData(inv.used_at) + (inv.profiles ? ' da ' + inv.profiles.display_name : '')
            : inv.revoked_at ? 'Revocato il ' + fmtData(inv.revoked_at)
            : 'Scaduto il ' + fmtData(inv.expires_at)}
        </p>
      )}
    </Pannello>
  );
}

function ModuloInvito({ onChiudi, onFatto }) {
  const settori = orderedSectors(state.sectors);
  const [ruolo, setRuolo] = useState('allenatore');
  const [nome, setNome] = useState('');
  const [giocatore, setGiocatore] = useState('');
  const [scelti, setScelti] = useState([]);
  const [giorni, setGiorni] = useState('14');

  const collegato = LINKED_ROLES.includes(ruolo);

  return (
    <Modulo
      titolo="Invita una persona"
      sotto="Il codice porta con sé ruolo, categorie e — per genitori e atleti — la scheda a cui collegarsi. Vale una volta sola e scade."
      etichettaInvia="Crea invito"
      onChiudi={onChiudi}
      onInvia={async () => {
        const inv = await createInvite({
          role: ruolo,
          playerId: collegato ? (giocatore || null) : null,
          sectorIds: collegato ? [] : scelti,
          label: nome.trim() || null,
          daysValid: parseInt(giorni, 10)
        });
        onFatto(inv.code);
      }}
    >
      <Campo etichetta="Ruolo" aiuto="Entrerà già con questo ruolo: nessuna promozione da fare dopo.">
        <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
          {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
        </Scelta>
      </Campo>

      <Campo etichetta="Nome della persona" aiuto="Serve solo a te, per ricordarti a chi l’hai mandato.">
        <Testo value={nome} onChange={e => setNome(e.target.value)} placeholder="Marco Bianchi" />
      </Campo>

      {collegato ? (
        <Campo etichetta="Collega alla scheda di" aiuto="Vedrà subito convocazioni, quote e documenti di questo atleta.">
          <Scelta value={giocatore} onChange={e => setGiocatore(e.target.value)}>
            <option value="">— nessuna, la collego dopo —</option>
            {state.roster.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => (
              <option key={p.id} value={p.id}>{p.name} · #{p.number}</option>
            ))}
          </Scelta>
        </Campo>
      ) : (
        <Campo etichetta="Categorie" aiuto="Senza categorie assegnate entra ma non vede nessuna rosa.">
          {settori.length === 0 ? (
            <p className="text-[12.5px] text-tenue">Nessuna categoria creata: creane una da Squadra.</p>
          ) : (
            <div className="space-y-1.5 rounded-lg bg-pannello/6 px-3 py-2.5">
              {settori.map(s => (
                <div key={s.id} style={s.parent_id ? { paddingLeft: '1.1rem' } : undefined}>
                  <Spunta
                    checked={scelti.includes(s.id)}
                    onChange={e => setScelti(v => (e.target.checked ? [...v, s.id] : v.filter(x => x !== s.id)))}
                    etichetta={s.name}
                  />
                </div>
              ))}
            </div>
          )}
        </Campo>
      )}

      <Campo etichetta="Validità">
        <Scelta value={giorni} onChange={e => setGiorni(e.target.value)}>
          <option value="7">7 giorni</option>
          <option value="14">14 giorni</option>
          <option value="30">30 giorni</option>
        </Scelta>
      </Campo>
    </Modulo>
  );
}

/* =================================================================== staff */
function Staff({ avvisa }) {
  const [modifica, setModifica] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);

  function nomiSettori(id) {
    const ids = state.staffSectors[id] || [];
    if (ids.length === 0) return 'Nessuna categoria assegnata';
    return ids.map(i => (state.sectors.find(s => s.id === i) || {}).name).filter(Boolean).join(', ');
  }

  return (
    <div>
      <Etichetta className="mb-2.5">Staff ({state.staff.length})</Etichetta>
      {state.staff.length === 0 ? (
        <Vuoto>Nessun membro dello staff registrato.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {state.staff.map((u, i) => {
            const io = u.id === state.currentUser.id;
            return (
              <div
                key={u.id}
                className={cx('flex items-center gap-3.5 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
              >
                <Avatar nome={u.display_name} dim={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">
                    {u.display_name} {io && <span className="text-[11px] font-normal text-tenue">(tu)</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-tenue">
                    {isAdmin(u) ? 'Tutte le categorie' : nomiSettori(u.id)}
                  </div>
                </div>
                <span className={cx('shrink-0 text-[11.5px] font-bold', TONO_RUOLO[u.role] || 'text-tenue')}>
                  {roleLabel(u.role)}
                </span>
                <button
                  onClick={() => setModifica(u)}
                  title="Modifica"
                  className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-pannello/12 hover:text-testo"
                >
                  ✎
                </button>
                {!io && (
                  <button
                    onClick={() => setDaRimuovere(u)}
                    title="Rimuovi"
                    className="shrink-0 rounded-lg px-2.5 py-2 text-tenue hover:bg-rosso/12 hover:text-rosso"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </Pannello>
      )}

      {modifica && (
        <ModuloUtente
          u={modifica}
          onChiudi={() => setModifica(null)}
          onFatto={() => { ridisegna(n => n + 1); avvisa('Utente salvato'); }}
        />
      )}

      {daRimuovere && (
        <Conferma
          titolo="Rimuovere l’utente?"
          testo={`${daRimuovere.display_name} non potrà più accedere. L’account resta, ma disattivato.`}
          etichetta="Rimuovi"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            const quantiAdmin = state.staff.filter(x => ADMIN_ROLES.includes(x.role)).length;
            if (ADMIN_ROLES.includes(daRimuovere.role) && quantiAdmin <= 1) {
              throw new Error('Deve rimanere almeno un amministratore.');
            }
            await deactivateProfile(daRimuovere.id);
            state.staff = state.staff.filter(x => x.id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Utente rimosso');
          }}
        />
      )}
    </div>
  );
}

function ModuloUtente({ u, onChiudi, onFatto }) {
  const settori = orderedSectors(state.sectors);
  const [nome, setNome] = useState(u.display_name || '');
  const [ruolo, setRuolo] = useState(u.role || '');
  const [scelti, setScelti] = useState(state.staffSectors[u.id] || []);
  const [finanza, setFinanza] = useState(u.finance_role || '');
  const puoiFinanza = isFinanceAdmin(state.currentUser);

  return (
    <Modulo
      titolo="Modifica utente"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Inserisci il nome.';
        // L'ultimo amministratore non può togliersi i poteri da solo: dopo non
        // resterebbe nessuno a rimetterglieli.
        if (ADMIN_ROLES.includes(u.role) && !ADMIN_ROLES.includes(ruolo)) {
          const quanti = state.staff.filter(x => ADMIN_ROLES.includes(x.role)).length;
          if (quanti <= 1) return 'Deve rimanere almeno un amministratore.';
        }

        const patch = { display_name: n, role: ruolo };
        if (puoiFinanza) patch.finance_role = finanza || null;
        const agg = await updateProfile(u.id, patch);
        Object.assign(u, agg);
        if (u.id === state.currentUser.id) Object.assign(state.currentUser, agg);

        const prima = state.staffSectors[u.id] || [];
        for (const id of scelti.filter(x => !prima.includes(x))) await assignStaffToSector(u.id, id);
        for (const id of prima.filter(x => !scelti.includes(x))) await removeStaffFromSector(u.id, id);
        state.staffSectors = await fetchStaffSectors(state.teamProfile.id);

        if (LINKED_ROLES.includes(ruolo)) {
          state.staff = state.staff.filter(x => x.id !== u.id);
        }
        onFatto();
      }}
    >
      <Campo etichetta="Nome e cognome">
        <Testo value={nome} onChange={e => setNome(e.target.value)} />
      </Campo>

      <Campo etichetta="Ruolo">
        <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
          {/* Se il ruolo attuale non è fra quelli previsti lo si mostra
              comunque: senza, salvando gli si assegnerebbe in silenzio il
              primo dell'elenco. */}
          {!ASSIGNABLE_ROLES.includes(u.role) && (
            <option value={u.role || ''}>{roleLabel(u.role)}</option>
          )}
          {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
        </Scelta>
      </Campo>

      <Campo etichetta="Categorie assegnate">
        {settori.length === 0 ? (
          <p className="text-[12.5px] text-tenue">Nessuna categoria creata: creane una da Squadra.</p>
        ) : (
          <div className="space-y-1.5 rounded-lg bg-pannello/6 px-3 py-2.5">
            {settori.map(s => (
              <div key={s.id} style={s.parent_id ? { paddingLeft: '1.1rem' } : undefined}>
                <Spunta
                  checked={scelti.includes(s.id)}
                  onChange={e => setScelti(v => (e.target.checked ? [...v, s.id] : v.filter(x => x !== s.id)))}
                  etichetta={s.name}
                />
              </div>
            ))}
          </div>
        )}
      </Campo>

      {puoiFinanza && (
        <Campo etichetta="Accesso alla finanza">
          <Scelta value={finanza} onChange={e => setFinanza(e.target.value)}>
            <option value="">Nessun accesso</option>
            <option value="admin">Amministratore</option>
            <option value="manager">Responsabile amministrativo</option>
            <option value="viewer_team">Responsabile società (sola lettura)</option>
            <option value="viewer_sector">Responsabile settore (sola lettura, solo i propri)</option>
          </Scelta>
        </Campo>
      )}
    </Modulo>
  );
}

/* ================================================================ famiglie */
function Famiglie({ avvisa }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [collega, setCollega] = useState(null);

  function carica() {
    if (inCampione()) { setDati([]); return; }
    setDati(null);
    fetchFamilyLinksForTeam(state.teamProfile.id).then(setDati).catch(setErrore);
  }
  useEffect(carica, []);

  if (errore) return <ErroreCaricamento cosa="gli account giocatore e genitore" errore={errore} onRiprova={carica} />;

  return (
    <div>
      <Etichetta className="mb-2.5">Giocatori e genitori</Etichetta>
      {!dati ? (
        <Scheletro righe={2} />
      ) : dati.length === 0 ? (
        <Vuoto>Nessun account giocatore o genitore registrato.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {dati.map((f, i) => (
            <div key={f.id} className={cx('px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}>
              <div className="flex items-center gap-3.5">
                <Avatar nome={f.display_name} dim={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">{f.display_name}</div>
                  <div className={cx('text-[11.5px] font-semibold', TONO_RUOLO[f.role] || 'text-tenue')}>
                    {roleLabel(f.role)}
                  </div>
                </div>
                <Pulsante className="shrink-0 py-1.5 text-[11.5px]" onClick={() => setCollega(f)}>
                  Collega
                </Pulsante>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(f.players || []).length === 0 ? (
                  <span className="text-[11.5px] text-ambra">Non collegato a nessun atleta: non vede niente.</span>
                ) : (
                  f.players.map(p => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-2 rounded-full bg-pannello/12 py-1 pl-3 pr-1.5 text-[12px]"
                    >
                      {p.name}
                      <button
                        title="Scollega"
                        onClick={async () => {
                          try {
                            await unlinkProfileFromPlayer(f.id, p.id);
                            f.players = f.players.filter(x => x.id !== p.id);
                            carica();
                            avvisa('Collegamento rimosso');
                          } catch (e) {
                            avvisa((e && e.message) || 'Non riuscito.', 'errore');
                          }
                        }}
                        className="grid h-5 w-5 place-items-center rounded-full text-tenue hover:bg-rosso/16 hover:text-rosso"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </Pannello>
      )}

      {collega && (
        <ModuloCollega
          f={collega}
          onChiudi={() => setCollega(null)}
          onFatto={() => { carica(); avvisa('Account collegato'); }}
        />
      )}
    </div>
  );
}

function ModuloCollega({ f, onChiudi, onFatto }) {
  const [giocatore, setGiocatore] = useState('');
  const gia = new Set((f.players || []).map(p => p.id));
  const liberi = state.roster.filter(p => !gia.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modulo
      titolo={'Collega ' + f.display_name}
      sotto="Vedrà convocazioni, quote e documenti dell’atleta collegato. Un genitore con due figli si collega due volte."
      etichettaInvia="Collega"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!giocatore) return 'Scegli un atleta.';
        await linkProfileToPlayer(f.id, giocatore);
        onFatto();
      }}
    >
      <Campo etichetta="Atleta" aiuto="Solo quelli della categoria aperta: per un’altra, cambia categoria e torna qui.">
        <Scelta value={giocatore} onChange={e => setGiocatore(e.target.value)}>
          <option value="">— scegli —</option>
          {liberi.map(p => <option key={p.id} value={p.id}>{p.name} · #{p.number}</option>)}
        </Scelta>
      </Campo>
    </Modulo>
  );
}
