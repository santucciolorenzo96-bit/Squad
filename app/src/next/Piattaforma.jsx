import React, { useEffect, useState } from 'react';
import { logout } from '../auth.js';
import { amIPlatformOwner, createActivationCode, listActivationCodes, revokeActivationCode } from '../api/platform.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Scheletro, cx } from './ui.jsx';
import { Modulo, Conferma, Campo, Testo, useAvviso, ProvvederAvvisi } from './moduli.jsx';

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
        <Pulsante variante="primario" className="py-1.5 text-[11.5px]" onClick={() => setModulo(true)}>
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
              className="py-2.5 text-[12px]"
              onClick={async () => {
                try { await navigator.clipboard.writeText(appena); avvisa('Codice copiato'); }
                catch (e) { avvisa('Copialo a mano: ' + appena); }
              }}
            >
              Copia
            </Pulsante>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
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

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
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
        <div className="text-[11.5px] text-tenue">
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
            className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue transition-colors hover:bg-pannello/12 hover:text-testo"
          >
            Copia
          </button>
          {onRitira && (
            <button
              onClick={onRitira}
              className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue transition-colors hover:bg-rosso/12 hover:text-rosso"
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
            className="mt-0.5 text-[11.5px] text-tenue transition-colors hover:text-testo"
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

      {onIscriviti && (
        <button
          onClick={onIscriviti}
          className="mt-8 w-full py-2 text-[12px] text-tenue transition-colors hover:text-testo"
        >
          Ho anche un codice per entrare in una società
        </button>
      )}
    </div>
  );
}
