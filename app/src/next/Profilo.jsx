import React, { useState } from 'react';
import { state } from '../state.js';
import { updateMyProfile } from '../api/profiles.js';
import { changePassword } from '../auth.js';
import { roleLabel, isLinkedUser, isAdmin } from '../utils/permissions.js';
import { sectorFullName } from '../utils/sectors.js';
import { PASSWORD_MIN, passwordProblem } from '../utils/format.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Avatar, Stato, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso } from './moduli.jsx';

/* Il profilo.
 *
 * È anche la pagina delle impostazioni: sono la stessa zona dell'interfaccia,
 * e tenerle separate costringerebbe a cercare in due posti cose che si fanno
 * nello stesso momento.
 *
 * In cima chi sei, sotto cosa puoi fare, poi le impostazioni, e in fondo — ben
 * separata — l'uscita.
 */

export function Profilo({ tema, onTema }) {
  const u = state.currentUser || {};
  const [modifica, setModifica] = useState(false);
  const [password, setPassword] = useState(false);
  const [esci, setEsci] = useState(false);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const mieiSettori = isAdmin(u)
    ? state.sectors
    : isLinkedUser(u)
      ? state.sectors.filter(s => state.familySectorIds.includes(s.id))
      : state.sectors.filter(s => (state.staffSectors[u.id] || []).includes(s.id));

  return (
    <div className="sezioni">
      <Titolo sopra="Il tuo account">Profilo</Titolo>

      {/* ---------------------------------------------------------- chi sei */}
      <Pannello alto className="pad-pannello">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar nome={u.display_name} url={state.myAvatarUrl} dim={80} />
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-bold leading-tight">{u.display_name}</div>
            <div className="mt-1 text-[12.5px] text-tenue">{u.email}</div>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <Stato tono="neutro">{roleLabel(u.role)}</Stato>
              {u.finance_role && <Stato tono="neutro">Finanza</Stato>}
            </div>
          </div>
          <Pulsante className="shrink-0" onClick={() => setModifica(true)}>Modifica</Pulsante>
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-tenue">
          La fotografia del profilo, con il ritaglio, si carica dall’app attuale: quella parte
          non è ancora stata rifatta qui.
        </p>
      </Pannello>

      {/* ------------------------------------------------------ cosa vedi */}
      <div>
        <Etichetta className="mb-2.5">Le tue categorie</Etichetta>
        <Pannello className="pad-pannello-stretto">
          {isAdmin(u) ? (
            <p className="text-[13px] text-soffuso">
              Come amministratore vedi <b className="text-testo">tutte le categorie</b> della società.
            </p>
          ) : mieiSettori.length === 0 ? (
            <p className="text-[13px] text-ambra">
              Nessuna categoria assegnata: puoi entrare, ma non vedi nessuna rosa.
              Chiedi a un amministratore di assegnartele.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {mieiSettori.map(s => (
                <span key={s.id} className="rounded-full bg-pannello/12 px-3 py-1 text-[12.5px] font-semibold">
                  {sectorFullName(s, state.sectors)}
                </span>
              ))}
            </div>
          )}
        </Pannello>
      </div>

      {isLinkedUser(u) && (
        <div>
          <Etichetta className="mb-2.5">I tuoi atleti</Etichetta>
          <Pannello className="overflow-hidden">
            {state.linkedPlayers.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ambra sm:px-5">
                Il tuo account non è ancora collegato a nessun atleta: chiedi alla società di collegarlo.
              </p>
            ) : (
              state.linkedPlayers.map((p, i) => (
                <div
                  key={p.id}
                  className={cx('flex items-center gap-3.5 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
                >
                  <Avatar nome={p.name} dim={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold leading-tight">{p.name}</div>
                    <div className="text-[11.5px] text-tenue">#{p.number}</div>
                  </div>
                </div>
              ))
            )}
          </Pannello>
        </div>
      )}

      {/* -------------------------------------------------- impostazioni */}
      <div>
        <Etichetta className="mb-2.5">Aspetto</Etichetta>
        <Pannello className="pad-pannello-stretto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-semibold">Tema</div>
              <p className="mt-0.5 text-[11.5px] text-tenue">
                «Sistema» segue l’impostazione del telefono o del computer.
              </p>
            </div>
            <div className="flex gap-1 rounded-full vetro orlo p-1">
              {['chiaro', 'sistema', 'scuro'].map(m => (
                <button
                  key={m}
                  onClick={() => onTema(m)}
                  className={cx(
                    'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-etichetta transition-all',
                    tema === m
                      ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
                      : 'text-tenue hover:text-testo'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </Pannello>
      </div>

      <div>
        <Etichetta className="mb-2.5">Sicurezza</Etichetta>
        <Pannello className="pad-pannello-stretto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-semibold">Password</div>
              <p className="mt-0.5 text-[11.5px] text-tenue">Serve quella attuale per cambiarla.</p>
            </div>
            <Pulsante onClick={() => setPassword(true)}>Cambia password</Pulsante>
          </div>
        </Pannello>
      </div>

      {/* ------------------------------------------------------- l'uscita */}
      {/* Staccata dal resto e in fondo: è l'unica azione della pagina che
          interrompe quello che stai facendo, e non deve stare a un dito di
          distanza da «Cambia password». */}
      <div className="pt-2">
        <button
          onClick={() => setEsci(true)}
          className="w-full rounded-lg border border-rosso/25 px-4 py-3 text-[13px] font-semibold text-rosso transition-colors hover:bg-rosso/10"
        >
          Esci dall’account
        </button>
      </div>

      {modifica && (
        <ModuloProfilo onChiudi={() => setModifica(false)} onFatto={() => { ridisegna(n => n + 1); avvisa('Profilo salvato'); }} />
      )}

      {password && (
        <ModuloPassword onChiudi={() => setPassword(false)} onFatto={() => avvisa('Password cambiata')} />
      )}

      {esci && (
        <Conferma
          titolo="Uscire dall’account?"
          testo="Dovrai reinserire email e password per rientrare."
          etichetta="Esci"
          onChiudi={() => setEsci(false)}
          onConferma={async () => {
            if (inCampione()) { avvisa('Nell’anteprima con dati di esempio non c’è nessuna sessione da chiudere.'); return; }
            const { goLogout } = await import('../router.js');
            await goLogout();
          }}
        />
      )}
    </div>
  );
}

function ModuloProfilo({ onChiudi, onFatto }) {
  const u = state.currentUser || {};
  const [nome, setNome] = useState(u.display_name || '');
  const [telefono, setTelefono] = useState(u.phone || '');

  return (
    <Modulo
      titolo="Modifica profilo"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Il nome non può restare vuoto.';
        const agg = await updateMyProfile({ display_name: n, phone: telefono.trim() || null });
        Object.assign(state.currentUser, agg);
        onFatto();
      }}
    >
      <Campo etichetta="Nome e cognome">
        <Testo value={nome} onChange={e => setNome(e.target.value)} autoFocus />
      </Campo>
      <Campo etichetta="Telefono" aiuto="Facoltativo. Lo vede solo lo staff della società.">
        <Testo value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="347 000 0000" />
      </Campo>
      <Campo etichetta="Email" aiuto="L’email è quella con cui accedi e non si cambia da qui.">
        <Testo value={u.email || ''} disabled className="opacity-60" />
      </Campo>
    </Modulo>
  );
}

function ModuloPassword({ onChiudi, onFatto }) {
  const [attuale, setAttuale] = useState('');
  const [nuova, setNuova] = useState('');
  const [ripeti, setRipeti] = useState('');

  return (
    <Modulo
      titolo="Cambia password"
      etichettaInvia="Cambia"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (!attuale) return 'Inserisci la password attuale.';
        const problema = passwordProblem(nuova, { field: 'La nuova password' });
        if (problema) return problema;
        if (nuova !== ripeti) return 'Le due nuove password non coincidono.';
        await changePassword(state.currentUser.email, attuale, nuova);
        onFatto();
      }}
    >
      <Campo etichetta="Password attuale">
        <Testo type="password" value={attuale} onChange={e => setAttuale(e.target.value)} autoFocus />
      </Campo>
      <Campo etichetta="Nuova password" aiuto={`Almeno ${PASSWORD_MIN} caratteri, con un numero.`}>
        <Testo type="password" value={nuova} onChange={e => setNuova(e.target.value)} />
      </Campo>
      <Campo etichetta="Ripeti la nuova password">
        <Testo type="password" value={ripeti} onChange={e => setRipeti(e.target.value)} />
      </Campo>
    </Modulo>
  );
}
