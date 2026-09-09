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
import { Etichetta, Vuoto, Scheletro, Titolo } from './ui.jsx';
import { caricaCampione } from './campione.js';

/* Anteprima della nuova interfaccia.
 *
 * Vive su una pagina sua e legge i DATI VERI della società attraverso le stesse
 * API e lo stesso `state` dell'app in produzione. Non è un mockup con dati
 * finti: un ridisegno giudicato su nomi inventati e numeri tondi mente, perché
 * i problemi veri li fanno i nomi lunghi, le rose da ventidue e le colonne che
 * restano vuote.
 *
 * L'app attuale non viene toccata in nessun modo: resta su index.html e
 * continua a funzionare mentre questa esiste.
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

/* ------------------------------------------------------- dati di esempio */
// Va detto forte, non in una nota a pie' di pagina: giudicare un'interfaccia
// credendo di vedere la propria societa' quando invece i dati sono inventati
// e' il modo piu' rapido di trarne la conclusione sbagliata.
function Nastro() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-r from-blu to-blu2 px-4 py-1.5 text-white sm:px-6">
      <span className="text-[10px] font-bold uppercase tracking-etichetta">Dati di esempio</span>
      <span className="text-[11.5px] opacity-90">
        Nessuna sessione aperta. <a href="/" className="underline">Accedi all&rsquo;app</a> e ricarica
        questa pagina per vedere il disegno sui dati veri.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ da fare */
// Le schermate non ancora portate lo dicono, invece di fingere di esistere.
function NonAncora({ nome }) {
  return (
    <div className="space-y-5">
      <Titolo sopra="Sezione"><span className="capitalize">{nome}</span></Titolo>
      <Vuoto>
        Questa schermata non è ancora stata rifatta. In questa passata ci sono il guscio,
        la Home e l&rsquo;Anagrafica: bastano a giudicare la direzione senza riscrivere
        tutte e trentadue.
      </Vuoto>
    </div>
  );
}

/* -------------------------------------------------------------------- radice */
function App() {
  const [fase, setFase] = useState('carico');   // carico | dentro
  const [campione, setCampione] = useState(false);
  const [sezione, setSezione] = useState('home');
  const [sectorId, setSectorId] = useState(null);
  const [tema, setTema] = useState(temaIniziale);

  useEffect(() => { applicaTema(tema); }, [tema]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const profilo = await fetchMyProfile();
        if (!vivo) return;
        if (!profilo) { avviaCampione(); return; }

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
        // Senza sessione, offline, o con Supabase irraggiungibile l'anteprima
        // si guarda lo stesso. Serve a giudicare un disegno: non potersi
        // aprire e' l'unico modo in cui puo' fallire del tutto.
        console.error(e);
        if (!vivo) return;
        avviaCampione();
      }

      function avviaCampione() {
        caricaCampione(state);
        setSectorId(state.activeSectorId);
        setCampione(true);
        setFase('dentro');
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

  if (fase === 'carico') {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <Etichetta>Squad · anteprima</Etichetta>
        <div className="mt-4"><Scheletro righe={4} /></div>
      </div>
    );
  }
  const contenuto = sectorId === null && sezione !== 'squadra' && sezione !== 'utenti'
    ? <Scheletro righe={4} />
    : sezione === 'home' ? <Home onSezione={setSezione} />
    : sezione === 'anagrafica' ? <Anagrafica />
    : <NonAncora nome={sezione} />;

  return (
    <>
      <Guscio
        sezione={sezione}
        onSezione={setSezione}
        sectorId={sectorId}
        onSettore={cambiaSettore}
        nastro={campione ? <Nastro /> : null}
      >
        {contenuto}
      </Guscio>

      {/* Il commutatore del tema sta qui e non nelle impostazioni perché
          questa è un'anteprima: serve a guardare le due versioni una dopo
          l'altra senza cercarlo. Nella versione definitiva torna al suo posto. */}
      <div className="fixed bottom-24 right-3 z-50 flex gap-0.5 rounded-full vetro-alto orlo p-1 shadow-lg lg:bottom-5">
        {['chiaro', 'sistema', 'scuro'].map(m => (
          <button
            key={m}
            onClick={() => setTema(m)}
            className={
              'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-etichetta transition-all ' +
              (tema === m
                ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
                : 'text-tenue hover:text-testo')
            }
          >
            {m}
          </button>
        ))}
      </div>
    </>
  );
}

// Con il ricaricamento a caldo Vite riesegue questo modulo, e un secondo
// createRoot sullo stesso nodo fa esplodere React durante lo sviluppo.
const nodo = document.getElementById('radice');
if (!nodo.__radice) nodo.__radice = createRoot(nodo);
nodo.__radice.render(<App />);
