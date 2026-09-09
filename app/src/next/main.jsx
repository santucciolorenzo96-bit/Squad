import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './carta.css';

import { state } from '../state.js';
import { fetchMyProfile } from '../api/profiles.js';
import { loadTeamWideData, loadFamilyLinks, loadSectorData } from '../router.js';
import { isLinkedUser, isAdmin } from '../utils/permissions.js';
import { Guscio } from './Guscio.jsx';
import { Home } from './Home.jsx';
import { Anagrafica } from './Anagrafica.jsx';
import { Foglio, Etichetta, Vuoto, Scheletro, Pulsante } from './ui.jsx';

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

const TEMA_KEY = 'bbapp_ink';

function applicaTema(modo) {
  const el = document.documentElement;
  if (modo === 'sistema') el.removeAttribute('data-ink');
  else el.setAttribute('data-ink', modo);
  try { localStorage.setItem(TEMA_KEY, modo); } catch (e) { /* modalità privata */ }
}

function temaIniziale() {
  try { return localStorage.getItem(TEMA_KEY) || 'sistema'; } catch (e) { return 'sistema'; }
}

/* ---------------------------------------------------------------- non entrato */
function FuoriSessione({ errore }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5">
      <Foglio rilievo className="w-full max-w-[420px] px-6 py-7">
        <Etichetta>Squad · anteprima</Etichetta>
        <h1 className="mt-2 font-serif text-[30px] leading-tight">Carta e inchiostro</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-grafite">
          {errore
            ? 'Non è stato possibile leggere i dati della società. ' + errore
            : 'Questa pagina mostra la nuova interfaccia sui dati veri della tua società, quindi prima devi entrare dall’app.'}
        </p>
        <a href="/" className="mt-5 block">
          <Pulsante variante="pieno" className="w-full">Vai all&rsquo;app e accedi</Pulsante>
        </a>
        <p className="mt-3 text-[11.5px] leading-relaxed text-grafite">
          Poi torna qui: la sessione è la stessa.
        </p>
      </Foglio>
    </div>
  );
}

/* ------------------------------------------------------------------ da fare */
// Le schermate non ancora portate lo dicono, invece di fingere di esistere.
function NonAncora({ nome }) {
  return (
    <div className="space-y-5">
      <div className="border-b-2 riga pb-3">
        <Etichetta>Categoria</Etichetta>
        <h1 className="font-serif text-[clamp(24px,5vw,34px)] leading-none capitalize">{nome}</h1>
      </div>
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
  const [fase, setFase] = useState('carico');   // carico | fuori | dentro
  const [errore, setErrore] = useState(null);
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
        if (!profilo) { setFase('fuori'); return; }

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
        console.error(e);
        if (!vivo) return;
        setErrore(e && e.message ? e.message : '');
        setFase('fuori');
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function cambiaSettore(id) {
    setSectorId(null);                 // vuota la schermata: mostrare la rosa
    state.activeSectorId = id;         // vecchia mentre arriva la nuova è peggio
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
  if (fase === 'fuori') return <FuoriSessione errore={errore} />;

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
      >
        {contenuto}
      </Guscio>

      {/* Il commutatore del tema sta qui e non nelle impostazioni perché
          questa è un'anteprima: serve a guardare le due versioni una dopo
          l'altra senza cercarlo. Nella versione definitiva torna al suo posto. */}
      <div className="fixed bottom-20 right-3 z-50 flex border-2 riga bg-carta shadow lg:bottom-4">
        {['chiaro', 'sistema', 'scuro'].map(m => (
          <button
            key={m}
            onClick={() => setTema(m)}
            className={
              'px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-etichetta ' +
              (tema === m ? 'bg-inchiostro text-carta' : 'text-grafite hover:text-inchiostro')
            }
          >
            {m}
          </button>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('radice')).render(<App />);
