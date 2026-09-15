import React, { useEffect, useState } from 'react';
import { logout } from '../auth.js';
import { state } from '../state.js';
import { amIPlatformOwner, createActivationCode, listActivationCodes, revokeActivationCode, listSocieties, enterSociety, listAccounts, deleteAccount } from '../api/platform.js';
import { SPORT_LIST } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Scheletro, cx, Vuoto, Stato, Cerca, NessunRisultato } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso, ProvvederAvvisi  } from './moduli.jsx';

/* La piattaforma.
 *
 * Due ruoli che non stanno sulla stessa scala. «Admin» dentro SQUAD vuol dire
 * «comando questa società»: rosa, categorie, stagioni, quote. SuperAdmin vuol
 * dire «decido quali società esistono», e non dà accesso ai dati di nessuna.
 * Se bastasse il primo per fare il secondo, ogni club potrebbe fabbricare
 * società a piacere e il codice di attivazione non varrebbe niente.
 *
 * Il ruolo è agganciato all'ACCOUNT e non al profilo (migrazione 028), quindi
 * un SuperAdmin può non appartenere a nessuna società. Quando è così, entrando
 * nell'app trova la console qui sotto e nient'altro: non c'è una rosa da
 * mostrargli, e mostrargliene una vuota sarebbe una bugia.
 *
 * Il controllo vero sta nel database: nascondere un pulsante non impedisce a
 * nessuno di chiamare la funzione, e infatti la funzione, a chi non è
 * nell'elenco, dice di no da sola.
 */

function fmtData(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PannelloCodici({ avvisa }) {
  const [abilitato, setAbilitato] = useState(null);   // null = ancora non lo so
  const [codici, setCodici] = useState(null);
  const [modulo, setModulo] = useState(false);
  const [appena, setAppena] = useState('');           // il codice appena generato
  const [daRitirare, setDaRitirare] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setAbilitato(false); return; }
    amIPlatformOwner().then(ok => {
      if (!vivo) return;
      setAbilitato(ok);
      if (ok) listActivationCodes().then(c => { if (vivo) setCodici(c); }).catch(() => setCodici([]));
    });
    return () => { vivo = false; };
  }, []);

  if (!abilitato) return null;

  const attivi = (codici || []).filter(c => !c.used_at && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const chiusi = (codici || []).filter(c => c.used_at || (c.expires_at && new Date(c.expires_at) <= new Date()));

  async function ricarica() {
    try { setCodici(await listActivationCodes()); } catch (e) { /* l'elenco resta com'era */ }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Etichetta>Nuove società</Etichetta>
        <Pulsante variante="primario" className="py-1.5 text-[12.5px]" onClick={() => setModulo(true)}>
          + Codice
        </Pulsante>
      </div>

      {/* Il codice appena generato sta grande e da solo: e' l'unico momento in
          cui serve leggerlo, ed e' il momento in cui si sbaglia a copiarlo. */}
      {appena && (
        <Pannello alto className="pad-pannello-stretto mb-2.5">
          <Etichetta>Codice appena creato</Etichetta>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <code className="min-w-[10rem] flex-1 select-all rounded-lg bg-pannello/12 px-3 py-2.5 font-mono text-[18px] font-bold tracking-[0.18em]">
              {appena}
            </code>
            <Pulsante
              className="py-2.5 text-[13px]"
              onClick={async () => {
                try { await navigator.clipboard.writeText(appena); avvisa('Codice copiato'); }
                catch (e) { avvisa('Copialo a mano: ' + appena); }
              }}
            >
              Copia
            </Pulsante>
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Consegnalo a chi deve aprire la società. Lo inserisce dove si inserisce
            un codice qualunque, in fondo alla pagina d'accesso: l'app capisce da sola
            che questo apre una società invece di far entrare in una.
          </p>
        </Pannello>
      )}

      <Pannello className="overflow-hidden">
        {codici === null ? (
          <div className="px-4 py-4"><Scheletro righe={2} /></div>
        ) : codici.length === 0 ? (
          <div className="px-4 py-5 text-[12.5px] leading-relaxed text-tenue">
            Nessun codice generato. Serve solo a chi apre una società nuova: senza,
            la registrazione e' chiusa.
          </div>
        ) : (
          <>
            {attivi.map((c, i) => (
              <RigaCodice
                key={c.code}
                c={c}
                primo={i === 0}
                avvisa={avvisa}
                onRitira={() => setDaRitirare(c)}
              />
            ))}
            {chiusi.map((c, i) => (
              <RigaCodice key={c.code} c={c} primo={attivi.length === 0 && i === 0} avvisa={avvisa} />
            ))}
          </>
        )}
      </Pannello>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Un codice vale UNA società e poi si consuma. Chi lo usa diventa
        l'amministratore di quella società: non ha nessun potere su questa.
      </p>

      {modulo && (
        <ModuloCodice
          onChiudi={() => setModulo(false)}
          onFatto={(codice) => { setAppena(codice); setModulo(false); ricarica(); avvisa('Codice creato'); }}
        />
      )}

      {daRitirare && (
        <Conferma
          titolo="Ritirare il codice?"
          testo="Smette di funzionare subito. Chi lo ha ricevuto e non lo ha ancora speso dovrà riceverne un altro."
          etichetta="Ritira"
          onChiudi={() => setDaRitirare(null)}
          onConferma={async () => {
            await revokeActivationCode(daRitirare.code);
            if (appena === daRitirare.code) setAppena('');
            await ricarica();
            avvisa('Codice ritirato');
          }}
        />
      )}
    </div>
  );
}

function RigaCodice({ c, primo, avvisa, onRitira }) {
  const speso = !!c.used_at;
  const scaduto = !speso && c.expires_at && new Date(c.expires_at) <= new Date();
  const giorni = c.expires_at
    ? Math.ceil((new Date(c.expires_at) - new Date()) / 86400000)
    : null;

  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5', !primo && 'border-t border-bordo/6')}>
      <code
        className={cx(
          'select-all font-mono text-[14px] font-bold tracking-[0.12em]',
          speso || scaduto ? 'text-tenue line-through' : ''
        )}
      >
        {c.code}
      </code>

      <div className="min-w-0 flex-1">
        {c.label && <div className="truncate text-[12.5px] font-semibold">{c.label}</div>}
        <div className="text-[12.5px] text-tenue">
          {speso
            ? 'Usato' + (c.used_by_name ? ' da ' + c.used_by_name : '') + ' il ' + fmtData((c.used_at || '').slice(0, 10))
            : scaduto
              ? 'Scaduto il ' + fmtData((c.expires_at || '').slice(0, 10))
              : giorni != null
                ? 'Scade fra ' + giorni + (giorni === 1 ? ' giorno' : ' giorni')
                : 'Senza scadenza'}
        </div>
      </div>

      {!speso && !scaduto && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(c.code); avvisa('Codice copiato'); }
              catch (e) { avvisa('Copialo a mano: ' + c.code); }
            }}
            className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-tenue transition-colors hover:bg-pannello/12 hover:text-testo"
          >
            Copia
          </button>
          {onRitira && (
            <button
              onClick={onRitira}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
            >
              Ritira
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ModuloCodice({ onChiudi, onFatto }) {
  const [etichetta, setEtichetta] = useState('');
  const [giorni, setGiorni] = useState('30');

  return (
    <Modulo
      titolo="Genera un codice per una nuova società"
      sotto="Vale una società sola e si consuma quando viene usato."
      etichettaInvia="Genera"
      onChiudi={onChiudi}
      onInvia={async () => {
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si genera niente.';
        const g = parseInt(giorni, 10);
        if (!g || g < 1 || g > 365) return 'La durata va da 1 a 365 giorni.';
        const codice = await createActivationCode(etichetta.trim(), g);
        onFatto(codice);
      }}
    >
      <Campo
        etichetta="A chi lo dai"
        aiuto="Solo per te: serve a ricordarti a chi hai dato quale codice, quando ne avrai dieci in giro."
      >
        <Testo
          value={etichetta}
          onChange={e => setEtichetta(e.target.value)}
          placeholder="Es. ASD Esempio — Mario Rossi"
          autoFocus
        />
      </Campo>
      <Campo etichetta="Giorni di validità" aiuto="Passati i quali smette di funzionare da solo.">
        <Testo type="number" min="1" max="365" value={giorni} onChange={e => setGiorni(e.target.value)} />
      </Campo>
    </Modulo>
  );
}

/* ============================================================= le societa' */
/* L'anagrafe, non il contenuto.
 *
 * Chi amministra la piattaforma deve sapere QUALI societa' esistono: senza,
 * l'unico modo di accorgersi che una e' nata e' ricordarsi di aver dato un
 * codice. Ma sapere che esistono e sapere cosa contengono sono due cose
 * diverse, e la seconda non deve succedere: rose, quote, certificati restano
 * di chi ne fa parte.
 *
 * Il confine non e' disegnato qui — e' nella funzione del database, che
 * restituisce solo queste colonne. Anche volendo, da questa schermata non c'e'
 * niente altro da mostrare.
 */
export function PannelloSocieta() {
  const [abilitato, setAbilitato] = useState(null);
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(null);
  const [entrando, setEntrando] = useState(null);   // id della societa' in cui si sta entrando

  async function entra(r) {
    if (entrando) return;
    setEntrando(r.id);
    try {
      await enterSociety(r.id);
      // Si ricarica invece di aggiornare lo stato: la societa' viene letta
      // all'avvio e sta in dieci posti diversi. Ricaricare e' l'unico modo
      // onesto di cambiarla tutta insieme.
      window.location.reload();
    } catch (e) {
      setEntrando(null);
      setErrore(e);
    }
  }

  // Il pannello si chiede da solo se tocca a lui: cosi funziona sia nella
  // console — dove ci arriva solo un SuperAdmin — sia dentro Squadra, dove
  // passa qualunque amministratore di societa e non deve vedere niente.
  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setAbilitato(false); return; }
    amIPlatformOwner().then(ok => {
      if (!vivo) return;
      setAbilitato(ok);
      if (!ok) return;
      listSocieties()
        .then(r => { if (vivo) setRighe(r); })
        .catch(e => { if (vivo) setErrore(e); });
    });
    return () => { vivo = false; };
  }, []);

  if (!abilitato) return null;

  const nomeSport = (k) => (SPORT_LIST.find(x => x.key === k) || {}).label || k;

  return (
    <div className="mt-7">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Etichetta>Società sulla piattaforma</Etichetta>
        {righe && <span className="cifra text-[12.5px] text-tenue">{righe.length}</span>}
      </div>

      {errore ? (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[12.5px] leading-relaxed text-ambra">
            L’elenco non si legge: {(errore && errore.message) || 'errore sconosciuto'}. Se la
            migrazione 029 non è ancora stata eseguita, questa funzione non esiste ancora.
          </p>
        </Pannello>
      ) : righe === null ? (
        <Pannello className="pad-pannello-stretto"><Scheletro righe={2} /></Pannello>
      ) : righe.length === 0 ? (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[12.5px] text-tenue">Nessuna società ancora registrata.</p>
        </Pannello>
      ) : (
        <Pannello className="overflow-hidden">
          {righe.map((r, i) => (
            <div
              key={r.id}
              className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5', i > 0 && 'border-t border-bordo/6')}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{r.name}</div>
                <div className="text-[12.5px] text-tenue">
                  {[nomeSport(r.sport), r.city, r.category].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="cifra text-[13px] font-semibold">{r.attivi}</div>
                <div className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">
                  {r.attivi === 1 ? 'persona' : 'persone'}
                </div>
              </div>
              <div className="w-full text-[12px] text-tenue sm:w-auto sm:pl-3">
                dal {fmtData((r.created_at || '').slice(0, 10))}
              </div>
              <Pulsante
                variante="primario"
                className="shrink-0 py-1.5 text-[12.5px]"
                disabled={!!entrando}
                onClick={() => entra(r)}
              >
                {entrando === r.id ? 'Entro…' : 'Entra'}
              </Pulsante>
            </div>
          ))}
        </Pannello>
      )}

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        «Entra» ti fa vedere la società come la vede un suo amministratore, e ti lascia
        cambiare quello che può cambiare lui. Ogni ingresso resta scritto, e finché sei
        dentro te lo ricorda un nastro in cima a ogni schermata.
      </p>

    </div>
  );
}

/* ================================================================= console */
/* Un SuperAdmin senza società: l'app non ha niente da mostrargli tranne
 * questo. Prima finiva su «Completa l'iscrizione», che gli chiedeva di
 * entrare in una società — cioè esattamente la cosa che non deve fare. */
export function ConsoleSuperAdmin({ email, onIscriviti }) {
  return (
    <ProvvederAvvisi>
      <ConsoleDentro email={email} onIscriviti={onIscriviti} />
    </ProvvederAvvisi>
  );
}

function ConsoleDentro({ email, onIscriviti }) {
  const avvisa = useAvviso();
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[46rem] px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img className="marchio-simbolo h-12 w-12 shrink-0" alt="" />
          <div>
            <Etichetta>Piattaforma</Etichetta>
            <h1 className="mt-1 text-[26px] font-bold leading-none tracking-tight">SuperAdmin</h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] font-semibold">{email}</div>
          <button
            onClick={async () => { await logout(); window.location.reload(); }}
            className="mt-0.5 text-[12.5px] text-tenue transition-colors hover:text-testo"
          >
            Esci
          </button>
        </div>
      </div>

      <Pannello className="pad-pannello-stretto mb-7">
        <p className="text-[12.5px] leading-relaxed text-tenue">
          Questo account non appartiene a nessuna società, ed è voluto: da qui si decide
          quali società possono nascere, non si entra nei loro dati. Le rose, le partite e i
          conti di ogni società restano visibili solo a chi ne fa parte.
        </p>
      </Pannello>

      <PannelloCodici avvisa={avvisa} />
      <PannelloSocieta />

      <PannelloAccount />

      {onIscriviti && (
        <button
          onClick={onIscriviti}
          className="mt-8 w-full py-2 text-[13px] text-tenue transition-colors hover:text-testo"
        >
          Ho anche un codice per entrare in una società
        </button>
      )}
    </div>
  );
}

/* ================================================================= account */
/* Chi ha un accesso, su tutta la piattaforma.
 *
 * Non e' la schermata Utenti di una societa': quella elenca chi lavora in
 * QUELLA societa' e sa disattivarlo. Qui si vedono tutti gli account che
 * esistono, anche quelli rimasti senza societa' — una registrazione lasciata a
 * meta', un indirizzo scritto male, la prova di due mesi fa — e si cancellano.
 *
 * Cancellare e' diverso da disattivare, e la differenza va detta dove si
 * clicca, non in un manuale: disattivare toglie l'accesso e lascia il nome
 * accanto a quello che la persona ha fatto; cancellare libera l'indirizzo
 * email e lascia quel lavoro senza autore.
 */
export function PannelloAccount() {
  const [abilitato, setAbilitato] = useState(null);
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState('');
  const [daCancellare, setDaCancellare] = useState(null);
  const avvisa = useAvviso();

  function carica() {
    setErrore(null);
    listAccounts().then(setRighe).catch(setErrore);
  }

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setAbilitato(false); return; }
    amIPlatformOwner().then(ok => {
      if (!vivo) return;
      setAbilitato(ok);
      if (ok) carica();
    });
    return () => { vivo = false; };
  }, []);

  if (!abilitato) return null;

  const visibili = (righe || []).filter(r => contiene(
    (r.email || '') + ' ' + (r.display_name || '') + ' ' + (r.team_name || ''), cerca
  ));

  const senzaSocieta = (righe || []).filter(r => !r.team_name).length;

  return (
    <div className="mt-7">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <Etichetta>Account sulla piattaforma</Etichetta>
        {righe && righe.length > 8 && (
          <Cerca
            valore={cerca}
            onCambia={setCerca}
            segnaposto="Cerca per email, nome o società"
            className="order-last w-full sm:order-none sm:w-64"
          />
        )}
        {righe && <span className="cifra text-[13px] text-tenue">{righe.length}</span>}
      </div>

      {errore ? (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[13px] leading-relaxed text-ambra">
            L’elenco non si legge: {(errore && errore.message) || 'errore sconosciuto'}. Se la
            migrazione 032 non è ancora stata eseguita, questa funzione non esiste ancora.
          </p>
        </Pannello>
      ) : righe === null ? (
        <Pannello className="pad-pannello-stretto"><Scheletro righe={3} /></Pannello>
      ) : visibili.length === 0 ? (
        cerca ? <NessunRisultato cosa="Nessun account" ago={cerca} />
              : <Vuoto>Nessun account registrato.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          {visibili.map((r, i) => {
            const io = r.user_id === (state.currentUser || {}).id;
            return (
              <div
                key={r.user_id}
                className={cx('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5',
                  i > 0 && 'border-t border-bordo/6')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{r.email}</span>
                    {r.is_owner && <Stato tono="buono">SuperAdmin</Stato>}
                    {io && <span className="text-[12px] text-tenue">(tu)</span>}
                    {!r.confirmed && <Stato tono="attesa">email non confermata</Stato>}
                    {r.active === false && <Stato tono="fermo">disattivato</Stato>}
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-tenue">
                    {r.team_name
                      ? [r.display_name, r.team_name, r.role].filter(Boolean).join(' · ')
                      : 'Nessuna società'}
                  </div>
                </div>

                <div className="shrink-0 text-right text-[12px] text-tenue">
                  <div>iscritto il {fmtData((r.created_at || '').slice(0, 10))}</div>
                  <div>
                    {r.last_sign_in_at
                      ? 'ultimo accesso ' + fmtData(r.last_sign_in_at.slice(0, 10))
                      : 'mai entrato'}
                  </div>
                </div>

                {!io && (
                  <Pulsante
                    className="shrink-0 py-1.5 text-[12.5px] !text-rosso"
                    onClick={() => setDaCancellare(r)}
                  >
                    Cancella
                  </Pulsante>
                )}
              </div>
            );
          })}
        </Pannello>
      )}

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Cancellare un account libera il suo indirizzo email e toglie il profilo dalla sua
        società. Quello che la persona ha inserito — allenamenti, documenti approvati,
        movimenti di cassa — resta dov’è e perde solo il nome dell’autore.
        {senzaSocieta > 0 && ' ' + senzaSocieta + (senzaSocieta === 1
          ? ' account non appartiene a nessuna società.'
          : ' account non appartengono a nessuna società.')}
      </p>

      {daCancellare && (
        <Conferma
          titolo="Cancellare questo account?"
          testo={
            daCancellare.email
            + (daCancellare.team_name ? ' — ' + daCancellare.team_name : ' — nessuna società')
            + '. L’indirizzo torna libero e il profilo sparisce. I dati che ha inserito nella '
            + 'società restano, senza più il suo nome. Non si annulla.'
            + (daCancellare.is_owner ? ' ATTENZIONE: è un amministratore di piattaforma.' : '')
          }
          etichetta="Cancella l’account"
          onChiudi={() => setDaCancellare(null)}
          onConferma={async () => {
            await deleteAccount(daCancellare.user_id, daCancellare.is_owner);
            setRighe(v => (v || []).filter(x => x.user_id !== daCancellare.user_id));
            avvisa('Account cancellato');
          }}
        />
      )}
    </div>
  );
}
