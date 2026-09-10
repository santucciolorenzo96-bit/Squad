import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './vetro.css';

import { state } from '../state.js';
import { fetchMyProfile } from '../api/profiles.js';
import { loadTeamWideData, loadFamilyLinks, loadSectorData } from '../router.js';
import { isLinkedUser, isAdmin } from '../utils/permissions.js';
import { Guscio } from './Guscio.jsx';
import { Home } from './Home.jsx';
import { Anagrafica } from './Anagrafica.jsx';
import { Rosa } from './Rosa.jsx';
import { Allenamenti } from './Allenamenti.jsx';
import { Calendario } from './Calendario.jsx';
import { Classifica } from './Classifica.jsx';
import { Statistiche } from './Statistiche.jsx';
import { Presenze } from './Presenze.jsx';
import { Situazione } from './Situazione.jsx';
import { Comunicazioni } from './Comunicazioni.jsx';
import { Documenti } from './Documenti.jsx';
import { Utenti } from './Utenti.jsx';
import { Squadra } from './Squadra.jsx';
import { Profilo } from './Profilo.jsx';
import { Finanza } from './Finanza.jsx';
import { Partita } from './Partita.jsx';
import { Accesso, CompletaIscrizione } from './Accesso.jsx';
import { supabase } from '../supabaseClient.js';
import { getPendingAction, runPendingAction, clearPendingAction } from '../auth.js';
import { Etichetta, Vuoto, Scheletro, Titolo } from './ui.jsx';
import { ProvvederAvvisi } from './moduli.jsx';
import { caricaCampione } from './campione.js';

/* SQUAD.
 *
 * Questa è l'app: la radice di index.html. Legge i dati della società
 * attraverso le stesse API e lo stesso `state` di prima — il ridisegno ha
 * rifatto la presentazione, non il funzionamento, e nessun dato è stato
 * spostato.
 *
 * La versione precedente resta su classica.html finché serve una via di
 * ritorno: stesso database, stessa sessione, interfaccia vecchia.
 */

const TEMA_KEY = 'bbapp_tema';

function applicaTema(modo) {
  const el = document.documentElement;
  if (modo === 'sistema') el.removeAttribute('data-tema');
  else el.setAttribute('data-tema', modo);
  try { localStorage.setItem(TEMA_KEY, modo); } catch (e) { /* modalità privata */ }
}

function temaIniziale() {
  try { return localStorage.getItem(TEMA_KEY) || 'sistema'; } catch (e) { return 'sistema'; }
}

/* --------------------------------------------------------------- il tema */
// Sta nella testata e non fisso in un angolo: un comando fisso sopra il
// contenuto copre sempre qualcosa, e in ogni schermata copre una cosa diversa.
// Nella versione definitiva questa scelta torna nelle impostazioni del profilo:
// qui è in vista perché serve a confrontare i due temi uno dopo l'altro.
function Tema({ valore, onCambia }) {
  return (
    <div className="hidden gap-0.5 rounded-full vetro orlo p-1 sm:flex">
      {['chiaro', 'sistema', 'scuro'].map(m => (
        <button
          key={m}
          onClick={() => onCambia(m)}
          title={'Tema ' + m}
          className={
            'rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-etichetta transition-all ' +
            (valore === m
              ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              : 'text-tenue hover:text-testo')
          }
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- dati di esempio */
// Va detto forte, non in una nota a pie' di pagina: giudicare un'interfaccia
// credendo di vedere la propria societa' quando invece i dati sono inventati
// e' il modo piu' rapido di trarne la conclusione sbagliata.
function Nastro({ onAccesso }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-r from-blu to-blu2 px-4 py-1.5 text-white sm:px-6">
      <span className="text-[10px] font-bold uppercase tracking-etichetta">Dati di esempio</span>
      <span className="text-[11.5px] opacity-90">
        Nessuna sessione aperta: questi non sono i tuoi dati.{' '}
        <button onClick={onAccesso} className="underline">Torna alle schermate d&rsquo;accesso</button>{' '}
        per entrare con il tuo account.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- ignota */
// Rete di sicurezza: una voce di menu senza schermata. Non dovrebbe capitare,
// e se capita e' meglio dirlo che mostrare una pagina bianca.
function NonAncora({ nome }) {
  return (
    <div className="space-y-5">
      <Titolo sopra="Sezione"><span className="capitalize">{nome}</span></Titolo>
      <Vuoto>Questa sezione non ha una schermata. È un difetto: segnalalo.</Vuoto>
    </div>
  );
}

/* -------------------------------------------------------------------- radice */
function App() {
  const [fase, setFase] = useState('carico');   // carico | accesso | completa | dentro
  const [campione, setCampione] = useState(false);
  const [recupero, setRecupero] = useState(null);   // { email, errore }
  const [sezione, setSezione] = useState('home');
  const [sectorId, setSectorId] = useState(null);
  const [tema, setTema] = useState(temaIniziale);

  useEffect(() => { applicaTema(tema); }, [tema]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let profilo = await fetchMyProfile();
        if (!vivo) return;

        if (!profilo) {
          // Autenticato ma senza profilo: c'e' un'iscrizione a meta'. Prima si
          // prova a portarla a termine da sola, e solo se non si puo' si
          // chiede all'utente. Senza questo passaggio, chi conferma l'email
          // resta fuori dalla propria societa' senza capire perche'.
          const { data: auth } = await supabase.auth.getUser();
          const sospesa = getPendingAction();
          let erroreSospeso = null;
          if (auth && auth.user && sospesa) {
            try {
              await runPendingAction(sospesa);
              profilo = await fetchMyProfile();
            } catch (e) {
              erroreSospeso = (e && e.message) || null;
              clearPendingAction();
            }
          }
          if (!vivo) return;
          if (!profilo && auth && auth.user) {
            setRecupero({ email: auth.user.email, errore: erroreSospeso });
            setFase('completa');
            return;
          }
          if (!profilo) { setFase('accesso'); return; }
        }

        state.currentUser = profilo;
        await loadTeamWideData();
        if (isLinkedUser(profilo)) await loadFamilyLinks();

        // Stessa preferenza dell'app: se non c'è, la prima categoria
        // accessibile in ordine.
        const accessibili = isAdmin(profilo)
          ? state.sectors.map(s => s.id)
          : isLinkedUser(profilo)
            ? state.familySectorIds
            : (state.staffSectors[profilo.id] || []);
        const ultimo = (() => { try { return localStorage.getItem('bbapp_last_sector'); } catch (e) { return null; } })();
        const scelto = (ultimo && accessibili.includes(ultimo))
          ? ultimo
          : ((state.sectors.find(s => accessibili.includes(s.id)) || {}).id || null);

        state.activeSectorId = scelto;
        if (scelto) await loadSectorData(scelto);
        if (!vivo) return;
        setSectorId(scelto);
        setFase('dentro');
      } catch (e) {
        // Senza sessione, offline, o con Supabase irraggiungibile si finisce
        // sulle schermate d'accesso: da lì si riprova o si guarda l'app con i
        // dati di esempio. Una pagina bianca sarebbe l'unico esito davvero
        // inutile.
        console.error(e);
        if (!vivo) return;
        setFase('accesso');
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function cambiaSettore(id) {
    state.activeSectorId = id;
    if (campione) { setSectorId(id); return; }   // non c'è niente da ricaricare
    setSectorId(null);                 // vuota la schermata: mostrare la rosa
    try { localStorage.setItem('bbapp_last_sector', id); } catch (e) { /* niente */ }
    await loadSectorData(id);
    setSectorId(id);
  }

  if (fase === 'completa') {
    return (
      <ProvvederAvvisi>
        <CompletaIscrizione
          email={recupero.email}
          erroreIniziale={recupero.errore}
          onFatto={() => window.location.reload()}
        />
      </ProvvederAvvisi>
    );
  }

  if (fase === 'accesso') {
    return (
      <ProvvederAvvisi>
        <Accesso
          onEntrato={() => window.location.reload()}
          onCampione={() => {
            caricaCampione(state);
            setSectorId(state.activeSectorId);
            setCampione(true);
            setFase('dentro');
          }}
        />
      </ProvvederAvvisi>
    );
  }

  if (fase === 'carico') {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <Etichetta>Squad</Etichetta>
        <div className="mt-4"><Scheletro righe={4} /></div>
      </div>
    );
  }
  const SCHERMATE = {
    home: () => <Home onSezione={setSezione} />,
    rosa: () => <Rosa />,
    anagrafica: () => <Anagrafica />,
    allenamenti: () => <Allenamenti />,
    calendario: () => <Calendario />,
    classifica: () => <Classifica />,
    statistiche: () => <Statistiche />,
    presenze: () => <Presenze />,
    comunicazioni: () => <Comunicazioni />,
    situazione: () => <Situazione onSezione={setSezione} />,
    documenti: () => <Documenti />,
    utenti: () => <Utenti />,
    squadra: () => <Squadra />,
    profilo: () => <Profilo tema={tema} onTema={setTema} />,
    finanza: () => <Finanza />,
    partita: () => <Partita />
  };

  // Situazione e le sezioni di societa' non dipendono dalla categoria aperta:
  // aspettarne il caricamento le terrebbe ferme davanti a uno scheletro per
  // niente.
  const dipendeDallaCategoria = !['situazione', 'documenti', 'utenti', 'squadra', 'finanza', 'profilo'].includes(sezione);
  const disegna = SCHERMATE[sezione];
  const contenuto = (sectorId === null && dipendeDallaCategoria)
    ? <Scheletro righe={4} />
    : disegna ? disegna()
    : <NonAncora nome={sezione} />;

  return (
    <ProvvederAvvisi>
      <Guscio
        sezione={sezione}
        onSezione={setSezione}
        sectorId={sectorId}
        onSettore={cambiaSettore}
        nastro={campione ? <Nastro onAccesso={() => { setCampione(false); setFase('accesso'); }} /> : null}
        strumenti={<Tema valore={tema} onCambia={setTema} />}
      >
        {contenuto}
      </Guscio>
    </ProvvederAvvisi>
  );
}

// Con il ricaricamento a caldo Vite riesegue questo modulo, e un secondo
// createRoot sullo stesso nodo fa esplodere React durante lo sviluppo.
const nodo = document.getElementById('radice');
if (!nodo.__radice) nodo.__radice = createRoot(nodo);
nodo.__radice.render(<App />);
