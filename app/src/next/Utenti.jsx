import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { Matita, Croce } from './icone.jsx';
import { contiene } from '../utils/format.js';
import {
  ROLES, ASSIGNABLE_ROLES, ADMIN_ROLES, LINKED_ROLES,
  isFinanceAdmin, isAdmin, roleLabel
} from '../utils/permissions.js';
import {
  updateProfile, deactivateProfile, fetchPending, approveMember, rejectMember
} from '../api/profiles.js';
import { proponiAtleta, altriCandidati } from '../utils/iscritti.js';
import { assignStaffToSector, removeStaffFromSector, fetchStaffSectors } from '../api/sectors.js';
import { fetchFamilyLinksForTeam, linkProfileToPlayer, unlinkProfileFromPlayer } from '../api/family.js';
import { fetchInvites, createInvite, revokeInvite } from '../api/invites.js';
import { orderedSectors } from '../utils/sectors.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, Avatar, cx, Cerca, NessunRisultato, AzioneRiga } from './ui.jsx';
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
          Il <b className="text-testo">codice società</b> (in Impostazioni) vale per tutti e non scade, ma fa
          entrare solo come atleta o genitore, e solo dopo che lo confermi tu: un codice che gira in una chat
          non dice chi è la persona che l’ha usato. Un <b className="text-testo">invito</b> vale per una persona
          sola, una volta sola, porta già con sé ruolo, categorie e collegamento — ed è l’unico modo per far
          entrare chi dovrà gestire qualcosa.
        </p>
      </Pannello>

      <Anticamera avvisa={avvisa} />
      <Inviti avvisa={avvisa} />
      <Staff avvisa={avvisa} />
      <Famiglie avvisa={avvisa} />
    </div>
  );
}

/* ============================================================== l'anticamera */
/* Chi ha usato il codice della società e aspetta di essere riconosciuto.
 *
 * Due cose in una schermata sola, perché sono lo stesso gesto: confermare che
 * quella persona può entrare, e collegarla alla scheda giusta. Rispondere «sì»
 * a «sono il genitore di Luca» senza fare il collegamento lascerebbe a metà
 * proprio la cosa che era stata chiesta — ed è così che finora gli atleti
 * finivano registrati come genitori.
 *
 * Il nome dell'atleta lo ha scritto chi si è iscritto. Noi proponiamo quello
 * che somiglia di più, e SOLO se non c'è dubbio: due nomi ugualmente vicini
 * non producono una scelta a caso, perché chi conferma con un tocco si fida
 * del tocco, e collegare un genitore al figlio di un altro è un errore che
 * nessuno andrà a ricontrollare.
 */
function Anticamera({ avvisa }) {
  const [righe, setRighe] = useState(null);
  const [scelto, setScelto] = useState(null);

  function carica() {
    if (inCampione()) { setRighe([]); return; }
    fetchPending().then(setRighe).catch(() => setRighe([]));
  }
  useEffect(carica, []);

  if (!righe || righe.length === 0) return null;

  return (
    <div>
      <Etichetta className="mb-2.5">
        {righe.length === 1 ? 'Una persona aspetta di entrare' : righe.length + ' persone aspettano di entrare'}
      </Etichetta>
      <Pannello className="overflow-hidden">
        {righe.map((r, i) => (
          <div key={r.id} className={cx('px-4 py-3.5 sm:px-5', i > 0 && 'border-t border-bordo/6')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-tight">{r.display_name}</div>
                <div className="mt-1 text-[12.5px] text-tenue">
                  {ROLES[r.role] || r.role}
                  {r.claim_note
                    ? (r.role === 'atleta' ? ' · in rosa come ' : ' · genitore di ') + r.claim_note
                    : ' · non ha detto di chi'}
                </div>
              </div>
              <Pulsante
                variante="primario"
                className="shrink-0 py-1.5 text-[12.5px]"
                onClick={() => setScelto(r)}
              >
                Guarda
              </Pulsante>
            </div>
          </div>
        ))}
      </Pannello>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Finché non li confermi non vedono niente: entrano, ma trovano una sala d’attesa.
      </p>

      {scelto && (
        <ModuloIscritto
          iscritto={scelto}
          onChiudi={() => setScelto(null)}
          onFatto={(testo) => {
            setRighe(x => x.filter(y => y.id !== scelto.id));
            avvisa(testo);
          }}
        />
      )}
    </div>
  );
}

function ModuloIscritto({ iscritto, onChiudi, onFatto }) {
  const rosa = state.roster || [];
  const proposto = proponiAtleta(iscritto.claim_note, rosa);
  const altri = altriCandidati(iscritto.claim_note, rosa);
  const [atleta, setAtleta] = useState(proposto ? proposto.id : '');
  const [ruolo, setRuolo] = useState(iscritto.role);
  const [rifiuta, setRifiuta] = useState(false);

  /* L'elenco completo è l'ultima spiaggia, non la prima: quasi sempre basta la
     proposta, e nei casi rimasti basta uno dei due o tre nomi vicini. Ma la
     categoria aperta è una sola, e l'atleta potrebbe essere in un'altra —
     quindi l'elenco c'è, e dice a quale rosa si riferisce. */
  const vicini = proposto ? [proposto, ...altri] : altri;
  const resto = rosa.filter(p => !vicini.some(v => v.id === p.id));

  return (
    <>
      <Modulo
        titolo={iscritto.display_name}
        sotto={'Chiede di entrare come ' + (ROLES[iscritto.role] || iscritto.role).toLowerCase()}
        etichettaInvia="Conferma"
        onChiudi={onChiudi}
        azioniExtra={
          <button
            type="button"
            onClick={() => setRifiuta(true)}
            className="rounded-lg px-3 py-2 text-[12.5px] font-semibold text-rosso transition-colors hover:bg-rosso/10"
          >
            Non lo conosco
          </button>
        }
        onInvia={async () => {
          if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';
          await approveMember(iscritto.id, atleta || null, ruolo);
          onFatto(atleta ? 'Confermato e collegato' : 'Confermato');
        }}
      >
        {iscritto.claim_note ? (
          <div className="rounded-lg bg-pannello/8 px-3.5 py-3">
            <Etichetta>Ha scritto</Etichetta>
            <p className="mt-1.5 text-[13.5px] leading-relaxed">
              {iscritto.role === 'atleta' ? 'Sono in rosa come ' : 'Sono il genitore di '}
              <b>{iscritto.claim_note}</b>
            </p>
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-ambra">
            Non ha scritto di chi si tratta: se non lo riconosci, meglio chiedere prima di
            confermare.
          </p>
        )}

        <Campo
          etichetta="È"
          aiuto="Se chi si è iscritto ha sbagliato, correggilo adesso: dopo, un atleta si ritrova chiamato genitore per tutto l’anno."
        >
          <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
            <option value="atleta">{ROLES.atleta}</option>
            <option value="genitore">{ROLES.genitore}</option>
          </Scelta>
        </Campo>

        <Campo
          etichetta="Collegalo alla scheda"
          aiuto={proposto
            ? 'Proposto in base al nome che ha scritto. Controlla che sia lui.'
            : 'Nessun nome somiglia abbastanza da proporlo: scegli tu, oppure lascia vuoto e collegalo dopo.'}
        >
          <Scelta value={atleta} onChange={e => setAtleta(e.target.value)}>
            <option value="">— nessuno per ora —</option>
            {vicini.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.number && p.number !== '-' ? ' · ' + p.number : ''}
              </option>
            ))}
            {resto.length > 0 && vicini.length > 0 && <option disabled>──────────</option>}
            {resto.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.number && p.number !== '-' ? ' · ' + p.number : ''}
              </option>
            ))}
          </Scelta>
        </Campo>

        <p className="text-[12.5px] leading-relaxed text-tenue">
          L’elenco è quello della categoria aperta. Se il suo atleta è in un’altra, cambia
          categoria in alto e riapri: oppure conferma adesso e collegalo dopo, da qui sotto.
        </p>
      </Modulo>

      {rifiuta && (
        <Conferma
          titolo="Non lo conosci?"
          testo={
            'La richiesta di ' + iscritto.display_name + ' sparisce, e il suo account resta '
            + 'senza società: potrà riprovare con il codice giusto. Non gli arriva nessun messaggio.'
          }
          etichetta="Rifiuta"
          onChiudi={() => setRifiuta(false)}
          onConferma={async () => {
            await rejectMember(iscritto.id);
            onFatto('Richiesta rifiutata');
            onChiudi();
          }}
        />
      )}
    </>
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
        <Pulsante variante="primario" className="py-1.5 text-[12.5px]" onClick={() => setNuovo(true)}>
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
            className="mt-3 w-full rounded-lg vetro orlo py-2 text-[13px] font-semibold text-tenue hover:text-testo"
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
          <div className="mt-1 text-[13px] text-tenue">
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
              className="py-2 text-[12.5px]"
              onClick={async () => {
                try { await navigator.clipboard.writeText(inv.code); avvisa('Codice copiato'); }
                catch (e) { avvisa('Copialo a mano: ' + inv.code); }
              }}
            >
              Copia
            </Pulsante>
            {onRevoca && (
              <AzioneRiga etichetta="Revoca" pericolo onClick={onRevoca}>
                <Croce />
              </AzioneRiga>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-tenue">
            {inv.expires_at ? 'Scade il ' + fmtData(inv.expires_at) : 'Senza scadenza'}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12.5px] text-tenue">
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
  const [cerca, setCerca] = useState('');
  const [, ridisegna] = useState(0);

  // Nome, email e ruolo insieme: si cerca una persona tanto per come si chiama
  // quanto per cosa fa nella societa'.
  const visibili = state.staff.filter(u => contiene(
    (u.display_name || '') + ' ' + (u.email || '') + ' ' + (u.role || ''), cerca
  ));

  function nomiSettori(id) {
    const ids = state.staffSectors[id] || [];
    if (ids.length === 0) return 'Nessuna categoria assegnata';
    return ids.map(i => (state.sectors.find(s => s.id === i) || {}).name).filter(Boolean).join(', ');
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <Etichetta>Staff ({state.staff.length})</Etichetta>
        {state.staff.length > 8 && (
          <Cerca
            valore={cerca}
            onCambia={setCerca}
            segnaposto="Cerca una persona"
            className="order-last w-full sm:order-none sm:w-56"
          />
        )}
      </div>
      {state.staff.length === 0 ? (
        <Vuoto>Nessun membro dello staff registrato.</Vuoto>
      ) : visibili.length === 0 ? (
        <NessunRisultato cosa="Nessuna persona" ago={cerca} />
      ) : (
        <Pannello className="overflow-hidden">
          {visibili.map((u, i) => {
            const io = u.id === state.currentUser.id;
            return (
              <div
                key={u.id}
                className={cx('flex items-center gap-3.5 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
              >
                <Avatar nome={u.display_name} dim={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">
                    {u.display_name} {io && <span className="text-[12px] font-normal text-tenue">(tu)</span>}
                  </div>
                  <div className="truncate text-[12.5px] text-tenue">
                    {isAdmin(u) ? 'Tutte le categorie' : nomiSettori(u.id)}
                  </div>
                </div>
                <span className={cx('shrink-0 text-[12.5px] font-bold', TONO_RUOLO[u.role] || 'text-tenue')}>
                  {roleLabel(u.role)}
                </span>
                <AzioneRiga etichetta="Modifica" onClick={() => setModifica(u)}>
                  <Matita />
                </AzioneRiga>
                {!io && (
                  <>
                    <span className="mx-1 h-5 w-px shrink-0 bg-bordo/12" aria-hidden="true" />
                    <AzioneRiga etichetta="Rimuovi" pericolo onClick={() => setDaRimuovere(u)}>
                      <Croce />
                    </AzioneRiga>
                  </>
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
/* CAMBIARE IL RUOLO A UN ACCOUNT COLLEGATO.
 *
 * Serve soprattutto per una cosa: un atleta che si e' iscritto col codice
 * societa' e si e' ritrovato genitore. Succedeva perche' il modulo di
 * registrazione aveva «Genitore» gia' selezionato, e chi non lo toccava lo
 * diventava — quel difetto e' chiuso, ma chi si era gia' iscritto e' rimasto
 * com'era, e non c'era nessun posto in cui correggerlo.
 *
 * Solo il ruolo e il nome: categorie e finanza non riguardano un account
 * collegato, le sue categorie sono quelle dell'atleta a cui e' legato. Un
 * modulo con dentro tre campi che non servono fa pensare che servano.
 */
function ModuloRuoloCollegato({ f, onChiudi, onFatto }) {
  const [nome, setNome] = useState(f.display_name || '');
  const [ruolo, setRuolo] = useState(f.role || '');
  const diventaStaff = !LINKED_ROLES.includes(ruolo);

  return (
    <Modulo
      titolo="Chi è questa persona"
      sotto={f.display_name}
      onChiudi={onChiudi}
      etichettaInvia="Salva"
      onInvia={async () => {
        if (!nome.trim()) return 'Scrivi il nome.';
        if (!ruolo) return 'Scegli un ruolo.';
        if (inCampione()) return 'Nell\u2019anteprima con dati di esempio non si salva niente.';

        const agg = await updateProfile(f.id, { display_name: nome.trim(), role: ruolo });

        /* I DUE ELENCHI SONO LA STESSA TABELLA, GUARDATA DA DUE LATI.
         * «Staff» esclude genitori e atleti; questo elenco li comprende.
         * Cambiando ruolo la persona passa da uno all'altro, e se non lo si
         * dice anche a quello che sta in memoria resta per sbaglio in tutti e
         * due — o in nessuno — finche' non si ricarica l'app. */
        if (diventaStaff) {
          const gia = state.staff.some(x => x.id === f.id);
          state.staff = gia
            ? state.staff.map(x => (x.id === f.id ? { ...x, ...agg } : x))
            : [...state.staff, agg];
        } else {
          state.staff = state.staff.filter(x => x.id !== f.id);
        }

        onFatto(diventaStaff
          ? 'Adesso \u00e8 ' + (ROLES[ruolo] || ruolo).toLowerCase() + ': lo trovi nell\u2019elenco dello staff'
          : 'Ruolo aggiornato');
      }}
    >
      <Campo etichetta="Nome e cognome">
        <Testo value={nome} onChange={e => setNome(e.target.value)} />
      </Campo>

      <Campo etichetta="Ruolo">
        <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
          {!ASSIGNABLE_ROLES.includes(f.role) && (
            <option value={f.role || ''}>{roleLabel(f.role)}</option>
          )}
          {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
        </Scelta>
      </Campo>

      {LINKED_ROLES.includes(f.role) && LINKED_ROLES.includes(ruolo) && f.role !== ruolo && (
        <p className="-mt-1 text-[12.5px] leading-relaxed text-tenue">
          I collegamenti alle schede restano come sono: cambia solo come l’app si rivolge a
          questa persona — un atleta vede la propria scheda, un genitore quella di suo
          figlio.
        </p>
      )}

      {diventaStaff && (
        <p className="-mt-1 text-[12.5px] leading-relaxed text-ambra">
          Diventando {(ROLES[ruolo] || ruolo).toLowerCase()} esce da questo elenco e passa allo
          staff, dove gli si assegnano le categorie. I collegamenti alle schede restano.
        </p>
      )}
    </Modulo>
  );
}

function Famiglie({ avvisa }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [collega, setCollega] = useState(null);
  const [ruolo, setRuolo] = useState(null);
  const [altri, setAltri] = useState(false);   // il foglio per collegare uno staff

  // In elenco vanno i genitori e gli atleti — per loro il collegamento E' la
  // ragione dell'account — piu' chiunque altro ne abbia gia' uno. Gli altri
  // account restano fuori finche' non si chiede di collegarne uno: uno staff
  // senza collegamenti non e' un problema da segnalare.
  const inElenco = (dati || []).filter(f => LINKED_ROLES.includes(f.role) || (f.linkedPlayers || []).length > 0);
  const collegabili = (dati || []).filter(f => !inElenco.some(x => x.id === f.id));

  function carica() {
    if (inCampione()) { setDati([]); return; }
    setDati(null);
    fetchFamilyLinksForTeam(state.teamProfile.id).then(setDati).catch(setErrore);
  }
  useEffect(carica, []);

  if (errore) return <ErroreCaricamento cosa="gli account giocatore e genitore" errore={errore} onRiprova={carica} />;

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <Etichetta>Collegamenti agli atleti</Etichetta>
        {collegabili.length > 0 && (
          <Pulsante className="shrink-0 py-1.5 text-[12.5px]" onClick={() => setAltri(true)}>
            Collega un altro account
          </Pulsante>
        )}
      </div>
      {!dati ? (
        <Scheletro righe={2} />
      ) : inElenco.length === 0 ? (
        <Vuoto>Nessun account collegato a una scheda atleta.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {inElenco.map((f, i) => (
            <div key={f.id} className={cx('px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}>
              <div className="flex items-center gap-3.5">
                <Avatar nome={f.display_name} dim={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">{f.display_name}</div>
                  <div className={cx('text-[12.5px] font-semibold', TONO_RUOLO[f.role] || 'text-tenue')}>
                    {roleLabel(f.role)}
                  </div>
                </div>
                <Pulsante className="shrink-0 py-1.5 text-[12.5px]" onClick={() => setCollega(f)}>
                  Collega
                </Pulsante>
                {/* IL RUOLO SI CAMBIA DA QUI, E DA NESSUN'ALTRA PARTE.
                    L'elenco «Staff» esclude apposta genitori e atleti — non
                    sono staff — e quindi chi si e' iscritto col ruolo
                    sbagliato non compariva in nessun modulo che lo potesse
                    correggere. Il database lo permetteva da sempre: mancava
                    il pulsante. */}
                <AzioneRiga etichetta="Cambia ruolo" onClick={() => setRuolo(f)}>
                  <Matita />
                </AzioneRiga>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(f.linkedPlayers || []).length === 0 ? (
                  <span className="text-[12.5px] text-ambra">
                    {LINKED_ROLES.includes(f.role)
                      ? 'Non collegato a nessun atleta: non vede niente.'
                      : 'Nessun collegamento.'}
                  </span>
                ) : (
                  f.linkedPlayers.filter(Boolean).map(p => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-2 rounded-full bg-pannello/12 py-1 pl-3 pr-1.5 text-[13px]"
                    >
                      {p.name}
                      <button
                        title="Scollega"
                        onClick={async () => {
                          try {
                            await unlinkProfileFromPlayer(f.id, p.id);
                            carica();
                            avvisa('Collegamento rimosso');
                          } catch (e) {
                            avvisa((e && e.message) || 'Non riuscito.', 'errore');
                          }
                        }}
                        aria-label={'Scollega ' + p.name}
                        title={'Scollega ' + p.name}
                        className="tocco grid h-5 w-5 shrink-0 place-items-center rounded-full text-tenue hover:bg-rosso/16 hover:text-rosso"
                      >
                        <Croce dim={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </Pannello>
      )}

      {ruolo && (
        <ModuloRuoloCollegato
          f={ruolo}
          onChiudi={() => setRuolo(null)}
          onFatto={(msg) => { setRuolo(null); carica(); avvisa(msg); }}
        />
      )}

      {collega && (
        <ModuloCollega
          f={collega}
          onChiudi={() => setCollega(null)}
          onFatto={() => { carica(); avvisa('Account collegato'); }}
        />
      )}

      {altri && (
        <ModuloScegliAccount
          candidati={collegabili}
          onChiudi={() => setAltri(false)}
          onScelto={(f) => { setAltri(false); setCollega(f); }}
        />
      )}
    </div>
  );
}

/* Collegare qualcuno che non e' ne' genitore ne' atleta.
 *
 * E' il caso di chi nella societa' fa due cose. Il ruolo NON cambia: resta
 * quello che e'. Cambia solo cosa vede — la categoria dove c'e' la sua scheda —
 * e la vede da giocatore, senza poterci mettere mano.
 */
function ModuloScegliAccount({ candidati, onChiudi, onScelto }) {
  const [chi, setChi] = useState('');
  return (
    <Modulo
      titolo="Collega un altro account"
      sotto="Serve a chi nella società fa due cose: allena una categoria e gioca in un’altra. Il ruolo resta quello che è — la categoria collegata la vedrà da giocatore."
      etichettaInvia="Avanti"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!chi) return 'Scegli un account.';
        onScelto(candidati.find(x => x.id === chi));
      }}
    >
      <Campo etichetta="Account">
        <Scelta value={chi} onChange={e => setChi(e.target.value)}>
          <option value="">Scegli…</option>
          {candidati.slice().sort((a, b) => a.display_name.localeCompare(b.display_name)).map(c => (
            <option key={c.id} value={c.id}>{c.display_name} — {roleLabel(c.role)}</option>
          ))}
        </Scelta>
      </Campo>
    </Modulo>
  );
}

function ModuloCollega({ f, onChiudi, onFatto }) {
  const [giocatore, setGiocatore] = useState('');
  // Gli atleti gia' collegati non si ripropongono: il collegamento ha per
  // chiave la coppia (profilo, atleta), quindi rifarlo non e' un doppione
  // innocuo, e' un errore del database in faccia a chi sta lavorando.
  const gia = new Set((f.linkedPlayers || []).filter(Boolean).map(p => p.id));
  const liberi = state.roster.filter(p => !gia.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modulo
      titolo={'Collega ' + f.display_name}
      sotto={'Atleti della categoria aperta. Se la scheda sta in un’altra categoria, aprila prima dal selettore in alto. Un genitore con due figli si collega due volte.'}
      etichettaInvia="Collega"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!giocatore) return 'Scegli un atleta.';
        try {
          await linkProfileToPlayer(f.id, giocatore);
        } catch (e) {
          // Se il collegamento esiste gia' il database risponde con la
          // violazione della chiave primaria, che a chi guarda non dice
          // niente. Succede quando l'elenco a schermo e' vecchio.
          const msg = (e && e.message) || '';
          if (msg.indexOf('profile_players_pkey') >= 0 || msg.indexOf('duplicate key') >= 0) {
            return 'Questo account è già collegato a quell’atleta. Ricarica la pagina per vedere i collegamenti aggiornati.';
          }
          throw e;
        }
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
