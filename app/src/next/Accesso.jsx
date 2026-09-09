import React, { useState } from 'react';
import { esc, passwordProblem, PASSWORD_MIN } from '../utils/format.js';
import { SPORT_LIST } from '../utils/sports/index.js';
import { ROLES, SELF_SIGNUP_ROLES } from '../utils/permissions.js';
import { login as apiLogin, createTeamAndAdmin, joinTeamByCode, resendConfirmation, requestPasswordReset } from '../auth.js';
import { fetchTeamByInviteCode } from '../api/teams.js';
import { fetchInvitePreview } from '../api/invites.js';
import { acceptPrivacy } from '../api/privacy.js';
import { Pannello, Etichetta, Pulsante, cx } from './ui.jsx';
import { Campo, Testo, Scelta, Spunta } from './moduli.jsx';
import { Chevron } from './icone.jsx';

/* Le schermate prima dell'accesso.
 *
 * Non usano il guscio dell'app: qui non c'è ancora una società, né categorie,
 * né sezioni. C'è una colonna stretta al centro e una cosa sola da fare per
 * schermata.
 *
 * La gerarchia della prima schermata segue chi la usa davvero: quasi tutti
 * sono genitori e atleti che entrano in un account già esistente; la seconda
 * azione più frequente è entrare con un codice. Registrare una società capita
 * una volta sola per club, quindi sta in fondo — visibile, non ingombrante.
 */

const PASSI = {
  landing: 'landing', accedi: 'accedi', entra: 'entra',
  crea: 'crea', conferma: 'conferma', recupero: 'recupero'
};

/* ------------------------------------------------------------------ guscio */
function Colonna({ children, sotto }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[24rem] animate-salita">
        {/* Il marchio: simbolo grande, la scritta sotto. È la prima cosa che
            si vede aprendo l'app, e prima dell'accesso non c'è nient'altro a
            dire dove si è finiti. */}
        <div className="mb-8 flex flex-col items-center gap-3.5 text-center">
          <img className="marchio-simbolo h-[104px] w-auto sm:h-[124px]" alt="" />
          <img className="marchio-scritta w-[min(200px,58vw)] h-auto" alt="SQUAD" />
          <div className="text-[12px] text-tenue">Gestionale per società sportive</div>
        </div>
        {children}
      </div>
      {sotto && <div className="mt-6 w-full max-w-[24rem]">{sotto}</div>}
    </div>
  );
}

function Indietro({ onClick, testo = 'Indietro' }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
    >
      <span className="rotate-180"><Chevron dim={13} /></span> {testo}
    </button>
  );
}

function Errore({ testo }) {
  if (!testo) return null;
  return (
    <div className="mt-4 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] leading-snug text-rosso">
      {testo}
    </div>
  );
}

/* ================================================================== radice */
export function Accesso({ onEntrato, onCampione }) {
  const [passo, setPasso] = useState(PASSI.landing);
  const [emailConfermata, setEmailConfermata] = useState('');

  const vai = (p) => setPasso(p);

  if (passo === PASSI.accedi) return <Accedi onEntrato={onEntrato} onIndietro={() => vai(PASSI.landing)} onRecupero={() => vai(PASSI.recupero)} />;
  if (passo === PASSI.entra) return <Entra onEntrato={onEntrato} onIndietro={() => vai(PASSI.landing)} onConferma={(e) => { setEmailConfermata(e); vai(PASSI.conferma); }} />;
  if (passo === PASSI.crea) return <Crea onEntrato={onEntrato} onIndietro={() => vai(PASSI.landing)} onConferma={(e) => { setEmailConfermata(e); vai(PASSI.conferma); }} />;
  if (passo === PASSI.conferma) return <ConfermaEmail email={emailConfermata} onAccedi={() => vai(PASSI.accedi)} />;
  if (passo === PASSI.recupero) return <Recupero onIndietro={() => vai(PASSI.accedi)} />;

  return (
    <Colonna
      sotto={onCampione && (
        <button
          onClick={onCampione}
          className="w-full rounded-lg vetro orlo py-2.5 text-[12px] font-semibold text-tenue transition-colors hover:text-testo"
        >
          Guarda l’app con dati di esempio
        </button>
      )}
    >
      <Pulsante variante="primario" onClick={() => vai(PASSI.accedi)} className="w-full py-3.5 text-[15px]">
        Accedi
      </Pulsante>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-bordo/12" />
        <span className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">oppure</span>
        <span className="h-px flex-1 bg-bordo/12" />
      </div>

      <div className="space-y-2.5">
        <Ingresso
          titolo="Ho un codice"
          nota="Te l’ha dato la tua società. Bastano un minuto e la tua email."
          tono="from-ciano to-blu"
          onClick={() => vai(PASSI.entra)}
        />
        <Ingresso
          titolo="Registra la tua società"
          nota="Sei un dirigente o un allenatore e vuoi iniziare da zero."
          tono="from-viola to-blu2"
          onClick={() => vai(PASSI.crea)}
        />
      </div>
    </Colonna>
  );
}

function Ingresso({ titolo, nota, tono, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-lg vetro orlo px-4 py-3.5 text-left transition-all hover:bg-pannello/12 active:scale-[0.99]"
    >
      <span className={cx('h-10 w-1 shrink-0 rounded-full bg-gradient-to-b', tono)} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-tight">{titolo}</span>
        <span className="mt-1 block text-[11.5px] leading-snug text-tenue">{nota}</span>
      </span>
      <Chevron dim={16} className="shrink-0 text-tenue" />
    </button>
  );
}

/* ================================================================= accedi */
function Accedi({ onEntrato, onIndietro, onRecupero }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mostra, setMostra] = useState(false);
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  async function entra() {
    setErrore('');
    if (!email.trim()) { setErrore('Inserisci la tua email.'); return; }
    if (!pass) { setErrore('Inserisci la password.'); return; }
    setLavora(true);
    try {
      await apiLogin(email.trim(), pass);
      onEntrato();
    } catch (e) {
      // Il messaggio di Supabase è in inglese e dice "Invalid login
      // credentials": non aiuta nessuno, e non va tradotto alla lettera perché
      // non deve rivelare se l'email esiste.
      setErrore(/invalid login/i.test((e && e.message) || '')
        ? 'Email o password non corrette.'
        : ((e && e.message) || 'Accesso non riuscito.'));
    } finally {
      setLavora(false);
    }
  }

  return (
    <Colonna>
      <Pannello alto className="pad-pannello">
        <h1 className="text-[20px] font-bold leading-tight">Accedi</h1>

        <div className="mt-5 space-y-4">
          <Campo etichetta="Email">
            <Testo
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              autoFocus
            />
          </Campo>

          <Campo etichetta="Password">
            <div className="relative">
              <Testo
                type={mostra ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') entra(); }}
                autoComplete="current-password"
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setMostra(m => !m)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue hover:text-testo"
              >
                {mostra ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
          </Campo>
        </div>

        <Errore testo={errore} />

        <Pulsante
          variante="primario"
          onClick={entra}
          disabled={lavora}
          className="mt-5 w-full py-3.5 text-[15px]"
        >
          {lavora ? 'Accesso…' : 'Entra'}
        </Pulsante>

        <button
          onClick={onRecupero}
          className="mt-3 w-full py-1 text-[12px] text-tenue transition-colors hover:text-testo"
        >
          Ho dimenticato la password
        </button>
      </Pannello>

      <Indietro onClick={onIndietro} />
    </Colonna>
  );
}

/* =============================================================== recupero */
function Recupero({ onIndietro }) {
  const [email, setEmail] = useState('');
  const [fatto, setFatto] = useState(false);
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  return (
    <Colonna>
      <Pannello alto className="pad-pannello">
        <h1 className="text-[20px] font-bold leading-tight">Reimposta la password</h1>

        {fatto ? (
          <p className="mt-4 text-[13px] leading-relaxed text-soffuso">
            Se esiste un account con quell’indirizzo, è partita un’email con il link per
            reimpostare la password. Controlla anche la posta indesiderata.
          </p>
        ) : (
          <>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
              Ti mandiamo un link per sceglierne una nuova.
            </p>
            <div className="mt-4">
              <Campo etichetta="Email">
                <Testo
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  inputMode="email"
                  autoFocus
                />
              </Campo>
            </div>
            <Errore testo={errore} />
            <Pulsante
              variante="primario"
              disabled={lavora}
              className="mt-5 w-full py-3.5 text-[15px]"
              onClick={async () => {
                setErrore('');
                if (!email.trim()) { setErrore('Inserisci la tua email.'); return; }
                setLavora(true);
                try {
                  await requestPasswordReset(email.trim());
                  // Non si dice mai se l'indirizzo esiste: sarebbe un modo per
                  // scoprire chi ha un account.
                  setFatto(true);
                } catch (e) {
                  setFatto(true);
                } finally {
                  setLavora(false);
                }
              }}
            >
              {lavora ? 'Invio…' : 'Mandami il link'}
            </Pulsante>
          </>
        )}
      </Pannello>

      <Indietro onClick={onIndietro} testo="Torna all’accesso" />
    </Colonna>
  );
}

/* ================================================================== entra */
// Due passi: prima il codice, verificato subito, poi i dati personali. Chi
// sbaglia una lettera se ne accorge lì, non dopo aver compilato tutto.
function Entra({ onEntrato, onIndietro, onConferma }) {
  const [passo, setPasso] = useState(1);
  const [codice, setCodice] = useState('');
  const [societa, setSocieta] = useState(null);
  const [invito, setInvito] = useState(null);    // invito nominativo, se il codice è quello
  const [ruolo, setRuolo] = useState('genitore');

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mostra, setMostra] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  async function verifica() {
    setErrore('');
    const c = codice.trim().toUpperCase();
    if (c.length < 4) { setErrore('Inserisci il codice che ti ha dato la società.'); return; }
    setLavora(true);
    try {
      // Prima l'invito nominativo, poi il codice società: il primo è più
      // specifico e porta con sé ruolo e collegamenti già decisi.
      const inv = await fetchInvitePreview(c).catch(() => null);
      if (inv) {
        setInvito(inv);
        setSocieta({ name: inv.team_name, city: inv.city, sport: inv.sport });
        setPasso(2);
        return;
      }
      const t = await fetchTeamByInviteCode(c).catch(() => null);
      if (!t) {
        setErrore('Non troviamo niente con questo codice. Controlla di averlo copiato bene: potrebbe anche essere scaduto o già usato.');
        return;
      }
      setInvito(null);
      setSocieta(t);
      setPasso(2);
    } finally {
      setLavora(false);
    }
  }

  async function registra() {
    setErrore('');
    if (!nome.trim()) { setErrore('Scrivi il tuo nome e cognome.'); return; }
    if (!email.trim()) { setErrore('Serve la tua email: è con quella che accedi.'); return; }
    const pw = passwordProblem(pass);
    if (pw) { setErrore(pw); return; }
    if (!privacy) { setErrore('Per procedere serve il consenso al trattamento dei dati.'); return; }

    setLavora(true);
    try {
      const res = await joinTeamByCode({
        email: email.trim(),
        password: pass,
        inviteCode: codice.trim().toUpperCase(),
        displayName: nome.trim(),
        role: ruolo,
        personale: !!invito
      });
      if (res.needsEmailConfirmation) { onConferma(email.trim()); return; }
      try { await acceptPrivacy(); } catch (e) { console.error(e); }
      onEntrato();
    } catch (e) {
      setErrore((e && e.message) || 'Registrazione non riuscita.');
    } finally {
      setLavora(false);
    }
  }

  const sport = SPORT_LIST.find(s => s.key === (societa && societa.sport));

  return (
    <Colonna>
      {/* I due passi, dichiarati: si sa dove si è e quanto manca. */}
      <div className="mb-4 flex gap-2">
        {['La società', 'I tuoi dati'].map((t, i) => (
          <div key={t} className="flex-1">
            <div className={cx('h-1 rounded-full transition-colors',
              passo > i ? 'bg-gradient-to-r from-blu to-blu2' : 'bg-pannello/16')} />
            <div className={cx('mt-1.5 text-[10px] font-bold uppercase tracking-etichetta',
              passo > i ? 'text-soffuso' : 'text-tenue')}>
              {i + 1} · {t}
            </div>
          </div>
        ))}
      </div>

      {passo === 1 ? (
        <Pannello alto className="pad-pannello">
          <h1 className="text-[20px] font-bold leading-tight">Il codice della tua società</h1>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Sei nel posto giusto: te l’ha mandato la società. Funziona sia il codice generale
            sia un invito personale.
          </p>

          <div className="mt-4">
            <Testo
              value={codice}
              onChange={e => { setCodice(e.target.value.toUpperCase().replace(/\s/g, '')); setErrore(''); }}
              onKeyDown={e => { if (e.key === 'Enter') verifica(); }}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="A1B2C3"
              className="text-center text-[22px] font-bold tracking-[0.3em]"
              autoFocus
            />
          </div>

          <Errore testo={errore} />

          <Pulsante
            variante="primario"
            onClick={verifica}
            disabled={lavora}
            className="mt-5 w-full py-3.5 text-[15px]"
          >
            {lavora ? 'Verifico…' : 'Continua'}
          </Pulsante>
        </Pannello>
      ) : (
        <>
          {/* Conferma di dove si sta entrando, prima di chiedere qualunque
              dato: è l'unico momento in cui si può accorgersi di un codice
              sbagliato senza aver già compilato tutto. */}
          <Pannello className="mb-3 flex items-center gap-3 px-4 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blu to-blu2 text-[15px] font-bold text-white shadow-blu">
              {(societa.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold leading-tight">{societa.name}</div>
              <div className="truncate text-[11.5px] text-tenue">
                {[societa.city, sport && sport.label].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              onClick={() => { setPasso(1); setErrore(''); }}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue hover:text-testo"
            >
              Cambia
            </button>
          </Pannello>

          <Pannello alto className="pad-pannello">
            {invito ? (
              // Con un invito nominativo il ruolo l'ha già deciso chi invita:
              // richiederlo sarebbe una domanda a cui la risposta esiste già,
              // e con la possibilità di sbagliarla.
              <div className="mb-4 rounded-lg bg-pannello/8 px-3.5 py-3">
                <Etichetta>Entrerai come</Etichetta>
                <div className="mt-1.5 text-[14px] font-bold">{ROLES[invito.role] || invito.role}</div>
                {invito.player_name && (
                  <div className="mt-1 text-[12px] text-tenue">collegato a {invito.player_name}</div>
                )}
                {(invito.sector_names || []).length > 0 && (
                  <div className="mt-1 text-[12px] text-tenue">
                    categorie: {invito.sector_names.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <Campo etichetta="Chi sei?">
                  <Scelta value={ruolo} onChange={e => setRuolo(e.target.value)}>
                    {SELF_SIGNUP_ROLES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
                  </Scelta>
                </Campo>
                <p className="mt-1.5 text-[11.5px] leading-snug text-tenue">
                  Ruolo e categorie li sistema poi un amministratore: quello che scegli qui
                  non dà nessun potere da solo.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <Campo etichetta="Nome e cognome">
                <Testo value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" autoFocus />
              </Campo>
              <Campo etichetta="Email">
                <Testo type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" inputMode="email" />
              </Campo>
              <Campo etichetta="Scegli una password" aiuto={`Almeno ${PASSWORD_MIN} caratteri, con un numero.`}>
                <div className="relative">
                  <Testo
                    type={mostra ? 'text' : 'password'}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    autoComplete="new-password"
                    className="pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setMostra(m => !m)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue hover:text-testo"
                  >
                    {mostra ? 'Nascondi' : 'Mostra'}
                  </button>
                </div>
              </Campo>
            </div>

            <div className="mt-4 rounded-lg bg-pannello/8 px-3.5 py-3">
              <Spunta
                checked={privacy}
                onChange={e => setPrivacy(e.target.checked)}
                etichetta={
                  <span className="text-[12px] leading-snug">
                    Ho letto l’informativa sul trattamento dei dati e acconsento. Se l’atleta è
                    minorenne, dichiaro di esserne il genitore o il tutore.
                  </span>
                }
              />
            </div>

            <Errore testo={errore} />

            <Pulsante
              variante="primario"
              onClick={registra}
              disabled={lavora}
              className="mt-5 w-full py-3.5 text-[15px]"
            >
              {lavora ? 'Creo l’account…' : 'Crea il mio account'}
            </Pulsante>
          </Pannello>
        </>
      )}

      <Indietro onClick={passo === 2 ? () => setPasso(1) : onIndietro} />
    </Colonna>
  );
}

/* ==================================================================== crea */
function Crea({ onEntrato, onIndietro, onConferma }) {
  const [sport, setSport] = useState('basket');
  const [societa, setSocieta] = useState('');
  const [citta, setCitta] = useState('');
  const [categoria, setCategoria] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mostra, setMostra] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  return (
    <Colonna>
      <Pannello alto className="pad-pannello">
        <h1 className="text-[20px] font-bold leading-tight">Registra la tua società</h1>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
          Diventi tu l’amministratore. Le categorie, la rosa e il resto si aggiungono dopo,
          con calma.
        </p>

        <div className="mt-5">
          <Campo etichetta="Che sport fate?" aiuto="Non si cambia dopo: cambierebbe il significato di tutte le statistiche.">
            <div className="mt-1 space-y-2">
              {SPORT_LIST.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSport(s.key)}
                  className={cx(
                    'w-full rounded-lg px-3.5 py-3 text-left transition-all orlo',
                    sport === s.key ? 'vetro-alto ring-1 ring-blu' : 'vetro hover:bg-pannello/12'
                  )}
                >
                  <div className="text-[13.5px] font-semibold leading-tight">{s.label}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-tenue">{s.description}</div>
                </button>
              ))}
            </div>
          </Campo>
        </div>

        <div className="mt-4 space-y-4">
          <Campo etichetta="Nome della società">
            <Testo value={societa} onChange={e => setSocieta(e.target.value)} placeholder="Pallacanestro Aurora" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Città"><Testo value={citta} onChange={e => setCitta(e.target.value)} /></Campo>
            <Campo etichetta="Categoria"><Testo value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Serie D" /></Campo>
          </div>

          <div className="h-px bg-bordo/10" />

          <Campo etichetta="Nome e cognome">
            <Testo value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" />
          </Campo>
          <Campo etichetta="Email">
            <Testo type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" inputMode="email" />
          </Campo>
          <Campo etichetta="Scegli una password" aiuto={`Almeno ${PASSWORD_MIN} caratteri, con un numero.`}>
            <div className="relative">
              <Testo
                type={mostra ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="new-password"
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setMostra(m => !m)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-tenue hover:text-testo"
              >
                {mostra ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
          </Campo>
        </div>

        <div className="mt-4 rounded-lg bg-pannello/8 px-3.5 py-3">
          <Spunta
            checked={privacy}
            onChange={e => setPrivacy(e.target.checked)}
            etichetta={
              <span className="text-[12px] leading-snug">
                Ho letto l’informativa sul trattamento dei dati e acconsento, anche come
                titolare del trattamento per la mia società.
              </span>
            }
          />
        </div>

        <Errore testo={errore} />

        <Pulsante
          variante="primario"
          disabled={lavora}
          className="mt-5 w-full py-3.5 text-[15px]"
          onClick={async () => {
            setErrore('');
            if (!societa.trim()) { setErrore('Scrivi il nome della società.'); return; }
            if (!nome.trim()) { setErrore('Scrivi il tuo nome e cognome.'); return; }
            if (!email.trim()) { setErrore('Serve la tua email: è con quella che accedi.'); return; }
            const pw = passwordProblem(pass);
            if (pw) { setErrore(pw); return; }
            if (!privacy) { setErrore('Per procedere serve il consenso al trattamento dei dati.'); return; }
            setLavora(true);
            try {
              const res = await createTeamAndAdmin({
                email: email.trim(), password: pass,
                teamName: societa.trim(), city: citta.trim(), category: categoria.trim(),
                displayName: nome.trim(), sport
              });
              if (res.needsEmailConfirmation) { onConferma(email.trim()); return; }
              try { await acceptPrivacy(); } catch (e) { console.error(e); }
              onEntrato();
            } catch (e) {
              setErrore((e && e.message) || 'Registrazione non riuscita.');
            } finally {
              setLavora(false);
            }
          }}
        >
          {lavora ? 'Creo la società…' : 'Crea la società'}
        </Pulsante>
      </Pannello>

      <Indietro onClick={onIndietro} />
    </Colonna>
  );
}

/* ========================================================= conferma email */
function ConfermaEmail({ email, onAccedi }) {
  const [lavora, setLavora] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  const [errore, setErrore] = useState('');

  return (
    <Colonna>
      <Pannello alto className="pad-pannello">
        <h1 className="text-[20px] font-bold leading-tight">Conferma la tua email</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-soffuso">
          Abbiamo mandato un link a <b className="text-testo">{email}</b>. Aprilo, poi torna
          qui e accedi: la squadra si completa da sola al primo accesso.
        </p>

        {/* Il consiglio che evita il problema più frequente: aprendo il link
            altrove, l'azione in sospeso resta sul dispositivo di partenza e il
            codice viene richiesto una seconda volta. */}
        <p className="mt-3 rounded-lg bg-pannello/8 px-3.5 py-3 text-[12px] leading-relaxed text-tenue">
          Se non lo trovi, guarda nella posta indesiderata. Conviene aprirlo{' '}
          <b className="text-soffuso">sullo stesso dispositivo</b> da cui ti sei registrato:
          altrove ti verrà richiesto il codice una seconda volta.
        </p>

        {messaggio && (
          <div className="mt-4 rounded-lg bg-verde/12 px-3.5 py-2.5 text-[12.5px] text-verde">{messaggio}</div>
        )}
        <Errore testo={errore} />

        <Pulsante
          disabled={lavora}
          className="mt-4 w-full"
          onClick={async () => {
            setErrore(''); setMessaggio(''); setLavora(true);
            try {
              await resendConfirmation(email);
              setMessaggio('Email inviata di nuovo: controlla la posta.');
            } catch (e) {
              setErrore((e && e.message) || 'Non è stato possibile inviarla di nuovo.');
            } finally {
              setLavora(false);
            }
          }}
        >
          {lavora ? 'Invio…' : 'Non è arrivata, rimandala'}
        </Pulsante>

        <Pulsante variante="primario" onClick={onAccedi} className="mt-2.5 w-full py-3.5 text-[15px]">
          Vai all’accesso
        </Pulsante>
      </Pannello>
    </Colonna>
  );
}
