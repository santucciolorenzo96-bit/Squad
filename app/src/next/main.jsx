import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './vetro.css';

import { state } from '../state.js';
import { fetchMyProfile } from '../api/profiles.js';
import { loadTeamCore, loadTeamExtras, loadFamilyLinks, loadSectorData } from '../router.js';
import { isLinkedUser, isAdmin, TABS } from '../utils/permissions.js';
import { sectorIdsFor } from '../utils/sectors.js';
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
import { ConsoleSuperAdmin } from './Piattaforma.jsx';
import { amIPlatformOwner, currentSociety, leaveSociety, segnoOspite } from '../api/platform.js';
import { supabase } from '../supabaseClient.js';
import { getPendingAction, runPendingAction, clearPendingAction, logout } from '../auth.js';
import { Etichetta, Vuoto, Scheletro, Titolo, cx } from './ui.jsx';
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
            'rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-etichetta transition-all ' +
            (valore === m
              ? 'vivo text-white'
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
function Nastro({ onIndietro }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-r from-blu to-blu2 px-4 py-1.5 text-white sm:px-6">
      <span className="text-[11px] font-bold uppercase tracking-etichetta">Dati di esempio</span>
      <span className="text-[12.5px] opacity-90">
        Questa società non esiste: rosa, partite e conti sono inventati.{' '}
        <button onClick={onIndietro} className="underline">Torna alla console</button>.
      </span>
    </div>
  );
}

/* Il nastro di chi sta guardando la societa' di qualcun altro.
 *
 * Sta in cima a OGNI schermata, non solo alla prima, e non si chiude. Il
 * potere di un SuperAdmin dentro una societa' e' lo stesso di un suo
 * amministratore: la cosa piu' pericolosa che puo' capitare e' dimenticarsi
 * dove si e', e scrivere qualcosa credendo di essere a casa propria.
 *
 * Ambra e non blu: non e' un'informazione, e' un avvertimento. */
function NastroOspite({ societa }) {
  const [esco, setEsco] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-r from-ambra to-corallo px-4 py-1.5 text-white sm:px-6">
      <span className="text-[11px] font-bold uppercase tracking-etichetta">SuperAdmin</span>
      <span className="text-[12.5px] opacity-95">
        Stai guardando <b>{societa.name}</b>{societa.city ? ' \u00b7 ' + societa.city : ''}. Quello che cambi
        qui lo cambi a loro.
      </span>
      <button
        onClick={async () => {
          if (esco) return;
          setEsco(true);
          try { await leaveSociety(); } catch (e) { /* si esce comunque */ }
          window.location.reload();
        }}
        className="ml-auto shrink-0 rounded-lg bg-white/20 px-3 py-1 text-[12.5px] font-bold underline-offset-2 hover:bg-white/30"
      >
        {esco ? 'Esco\u2026' : 'Esci dalla societ\u00e0'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- ignota */
// Rete di sicurezza: una voce di menu senza schermata. Non dovrebbe capitare,
// e se capita e' meglio dirlo che mostrare una pagina bianca.
/* Quando l'avvio si rompe con la sessione aperta.
 *
 * Non è «non sei entrato»: sei entrato, ed è il database che non ha risposto.
 * Mandare alla schermata d'accesso una persona già autenticata le fa cercare
 * il problema nella password, che è il posto sbagliato — e se il guasto è una
 * migrazione, il messaggio qui sotto dice già quale.
 */
function Guasto({ errore, onEsci }) {
  const testo = (errore && errore.message) || 'Il database non ha risposto.';
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rosso/14 text-[22px]">
          !
        </div>
        <h1 className="mt-5 text-[22px] font-bold leading-tight">Sei entrato, ma i dati no</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-soffuso">{testo}</p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-tenue">
          Il tuo accesso è a posto: è la lettura dei dati che si è fermata. Non è una
          questione di password.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-lg vivo py-2.5 text-[13px] font-semibold text-white"
        >
          Riprova
        </button>
        <button
          onClick={onEsci}
          className="mt-2 w-full rounded-lg vetro orlo py-2.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo"
        >
          Esci
        </button>
      </div>
    </div>
  );
}

/* L'anticamera.
 *
 * Non è un errore e non è un divieto: è una persona che ha bussato e sta
 * aspettando che le aprano. La differenza la fanno le parole — «in attesa di
 * conferma» e non «accesso negato» — e il dire cosa sta succedendo davvero:
 * qualcuno in società deve riconoscere il tuo nome, e finché non lo fa qui
 * dentro non c'è niente da vedere.
 *
 * C'è anche l'uscita: chi ha sbagliato codice società non deve restare
 * intrappolato in una sala d'attesa che non finirà mai.
 */
function InAttesa({ onEsci }) {
  const u = state.currentUser || {};
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ambra/14 text-[22px]">
          ⏳
        </div>
        <h1 className="mt-5 text-[22px] font-bold leading-tight">Ci siamo quasi</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-soffuso">
          La tua richiesta è arrivata alla società. Qualcuno deve riconoscere il tuo nome e
          confermarti: di solito è questione di poco, e non devi fare altro.
        </p>
        {u.claim_note && (
          <p className="mt-4 rounded-lg bg-pannello/8 px-4 py-3 text-[13px] leading-relaxed text-soffuso">
            Hai scritto di essere {u.role === 'atleta' ? 'in rosa come' : 'il genitore di'}{' '}
            <b className="text-testo">{u.claim_note}</b>. Se non è così, esci e rifai la
            registrazione: è più facile adesso che dopo.
          </p>
        )}
        <p className="mt-4 text-[12.5px] leading-relaxed text-tenue">
          Quando ti confermano, entri con le stesse email e password di adesso.
        </p>
        <button
          onClick={onEsci}
          className="mt-6 w-full rounded-lg vetro orlo py-2.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo"
        >
          Esci
        </button>
      </div>
    </div>
  );
}

function NonAncora({ nome }) {
  return (
    <div className="space-y-5">
      <Titolo sopra="Sezione"><span className="capitalize">{nome}</span></Titolo>
      <Vuoto>Questa sezione non ha una schermata. È un difetto: segnalalo.</Vuoto>
    </div>
  );
}

/* ------------------------------------------------------------- l'indirizzo
 *
 * La sezione aperta sta nell'indirizzo. Serve a tre cose che prima non si
 * potevano fare: il tasto Indietro del telefono torna alla sezione di prima
 * invece di uscire dall'app, un collaboratore puo' ricevere il link di una
 * schermata precisa, e ricaricare la pagina non riporta sempre alla Home.
 *
 * Nel frammento (#) e non nel percorso: cosi' funziona su qualunque hosting
 * senza chiedergli di riscrivere gli indirizzi verso index.html, e senza una
 * sola richiesta in piu' al server.
 */
function leggiIndirizzo() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const pezzi = h.split('/').filter(Boolean);
  const nome = pezzi[0] || null;
  // Un indirizzo inventato non deve aprire una schermata che non esiste: se il
  // nome non e' una sezione vera, vale come se non ci fosse.
  const buona = nome && (nome === 'profilo' || TABS.some(t => t.id === nome));
  return { sezione: buona ? nome : null, settore: pezzi[1] || null };
}

function scriviIndirizzo(sezione, settore, sostituisci) {
  const nuovo = '#/' + sezione + (settore ? '/' + settore : '');
  if (window.location.hash === nuovo) return;
  try {
    // replaceState quando l'indirizzo sta solo rincorrendo lo stato (il primo
    // disegno, o un cambio di categoria): non e' un posto nuovo dove si e'
    // andati, e non deve occupare una tacca della cronologia.
    if (sostituisci) window.history.replaceState(null, '', nuovo);
    else window.history.pushState(null, '', nuovo);
  } catch (e) {
    window.location.hash = nuovo;
  }
}

/* -------------------------------------------------------------------- radice */
function App() {
  const [fase, setFase] = useState('carico');   // carico | accesso | completa | console | dentro
  const [lento, setLento] = useState(false);   // l'avvio sta durando troppo
  const [campione, setCampione] = useState(false);
  const [recupero, setRecupero] = useState(null);   // { email, errore }
  const [ospite, setOspite] = useState(null);      // la societa' in cui il SuperAdmin e' entrato
  const [sezione, setSezione] = useState(() => leggiIndirizzo().sezione || 'home');
  const [sectorId, setSectorId] = useState(null);
  // I dati della categoria stanno arrivando. Non svuota niente: il contenuto
  // di prima resta a schermo, smorzato, e non si puo' toccare.
  const [scambioCategoria, setScambioCategoria] = useState(false);
  const [attesaLunga, setAttesaLunga] = useState(false);
  // La categoria di cui i dati sono DAVVERO a schermo. Diversa da `sectorId`
  // per tutta la durata del caricamento: quella e' la scelta, questa e' cosa
  // si sta guardando, e la schermata si rimonta sulla seconda.
  const [categoriaResa, setCategoriaResa] = useState(null);
  const richiestaCategoria = useRef(0);
  const [tema, setTema] = useState(temaIniziale);
  const [guasto, setGuasto] = useState(null);   // l'avvio e' fallito, e non perche' manchi la sessione

  useEffect(() => { applicaTema(tema); }, [tema]);

  // Dentro l'app, l'indirizzo dice dove si e'. Fuori (accesso, console) no: le
  // schermate prima dell'ingresso non sono posti in cui tornare.
  useEffect(() => {
    if (fase !== 'dentro') return;
    const suo = leggiIndirizzo();
    // Si aggiunge una tacca alla cronologia solo quando si e' davvero cambiata
    // sezione: il primo disegno e i cambi di categoria sostituiscono, altrimenti
    // il tasto Indietro richiederebbe due tocchi per fare un passo.
    scriviIndirizzo(sezione, sectorId, !suo.sezione || suo.sezione === sezione);
  }, [fase, sezione, sectorId]);

  // Indietro e Avanti del browser, e i link incollati a mano.
  useEffect(() => {
    function torna() {
      const suo = leggiIndirizzo();
      if (suo.sezione) setSezione(suo.sezione);
      if (suo.settore) setSectorId(s => (s === suo.settore ? s : suo.settore));
    }
    window.addEventListener('popstate', torna);
    window.addEventListener('hashchange', torna);
    return () => {
      window.removeEventListener('popstate', torna);
      window.removeEventListener('hashchange', torna);
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    // Un avvio che non finisce non deve restare uno scheletro per sempre: dopo
    // dodici secondi la schermata lo dice e offre di riprovare. Non interrompe
    // niente — se il caricamento arriva dopo, entra lo stesso.
    const orologio = setTimeout(() => { if (vivo) setLento(true); }, 12000);
    (async () => {
      try {
        let profilo = await fetchMyProfile();
        if (!vivo) return;

        if (!profilo) {
          // Autenticato ma senza profilo: c'e' un'iscrizione a meta'. Prima si
          // prova a portarla a termine da sola, e solo se non si puo' si
          // chiede all'utente. Senza questo passaggio, chi conferma l'email
          // resta fuori dalla propria societa' senza capire perche'.
          const { data: auth } = await supabase.auth.getSession();
          const sospesa = getPendingAction();
          let erroreSospeso = null;
          if (auth && auth.session && sospesa) {
            try {
              await runPendingAction(sospesa);
              profilo = await fetchMyProfile();
            } catch (e) {
              erroreSospeso = (e && e.message) || null;
              clearPendingAction();
            }
          }
          if (!vivo) return;
          if (!profilo && auth && auth.session) {
            // Un SuperAdmin puo' non appartenere a nessuna societa': e' il suo
            // caso normale, non un'iscrizione lasciata a meta'. Chiedergli di
            // entrare in una societa' sarebbe chiedergli l'unica cosa che non
            // deve fare.
            const piattaforma = await amIPlatformOwner().catch(() => false);
            if (!vivo) return;

            // Ma se ci e' gia' ENTRATO, l'app non e' la console: e' quella
            // societa'. Il profilo che manca se lo costruisce qui, con i dati
            // che il database gli sta gia' riconoscendo.
            if (piattaforma) {
              const dentro = await currentSociety().catch(() => null);
              if (!vivo) return;
              if (dentro && dentro.team_id) {
                setOspite(dentro);
                profilo = {
                  id: auth.session.user.id,
                  team_id: dentro.team_id,
                  display_name: 'SuperAdmin',
                  role: 'admin',
                  active: true,
                  email: auth.session.user.email,
                  // La finanza e' l'unica sezione che non dipende dal ruolo ma
                  // da un permesso a parte: senza, un SuperAdmin entrava in
                  // una societa' e la sezione Finanza spariva dal menu.
                  finance_role: 'admin',
                  can_upload_documents: true,
                  can_score_matches: true,
                  daPiattaforma: true
                };
              }
            }

            if (!profilo) {
              setRecupero({ email: auth.session.user.email, errore: erroreSospeso });
              setFase(piattaforma ? 'console' : 'completa');
              return;
            }
          }
          if (!profilo) { setFase('accesso'); return; }
        }

        // Un SuperAdmin con una societa' propria che e' entrato altrove: il
        // database gli sta gia' rispondendo con l'altra, e l'app deve saperlo.
        if (profilo && !profilo.daPiattaforma && segnoOspite()) {
          const dentro = await currentSociety().catch(() => null);
          if (!vivo) return;
          if (dentro && dentro.team_id && dentro.team_id !== profilo.team_id) {
            setOspite(dentro);
            profilo = {
              ...profilo,
              team_id: dentro.team_id,
              role: 'admin',
              finance_role: 'admin',
              can_upload_documents: true,
              can_score_matches: true,
              daPiattaforma: true
            };
          }
        }

        /* CHI ASPETTA DI ESSERE CONFERMATO NON ENTRA.
         *
         * Con il codice della società si entra come famiglia e si resta in
         * attesa: un codice che gira in una chat di genitori non è una prova
         * di identità. Il database lo sa già — current_team_id() non risponde
         * finché approved_at è vuoto, quindi ogni lettura tornerebbe vuota —
         * e senza questa deviazione l'app mostrerebbe una società senza
         * niente dentro, che sembra un guasto.
         *
         * `approved_at === undefined` vuol dire che la migrazione 046 non è
         * stata eseguita: in quel caso si entra come prima. Una colonna che
         * manca non deve chiudere fuori nessuno. */
        if (profilo && !profilo.daPiattaforma && profilo.approved_at === null) {
          state.currentUser = profilo;
          setFase('attesa');
          return;
        }

        state.currentUser = profilo;
        // Solo il nucleo: nome della societa', categorie, permessi, stagione.
        // E' tutto quello che serve per disegnare il guscio.
        // I collegamenti alle schede si chiedono per chiunque, in parallelo:
        // sono quelli che fanno vedere a un allenatore anche la categoria in
        // cui gioca. Un account senza collegamenti li risolve a vuoto, e una
        // richiesta a vuoto in parallelo non rallenta l'avvio.
        await Promise.all([
          loadTeamCore(),
          isAdmin(profilo)
            ? Promise.resolve()
            : loadFamilyLinks().catch(() => { state.familySectorIds = []; })
        ]);

        // Stessa preferenza dell'app: se non c'è, la prima categoria
        // accessibile in ordine.
        const accessibili = sectorIdsFor(profilo, {
          staffSectors: state.staffSectors,
          familySectorIds: state.familySectorIds,
          sectors: state.sectors
        });
        const ultimo = (() => { try { return localStorage.getItem('bbapp_last_sector'); } catch (e) { return null; } })();
        const scelto = (ultimo && accessibili.includes(ultimo))
          ? ultimo
          : ((state.sectors.find(s => accessibili.includes(s.id)) || {}).id || null);

        state.activeSectorId = scelto;
        if (!vivo) return;

        // Si entra QUI, non dopo i dati della categoria: il guscio ha gia' il
        // suo scheletro per quando la categoria non e' pronta, e vedere la
        // propria societa' con la barra e le sezioni mentre la rosa arriva e'
        // un'altra cosa rispetto a quattro rettangoli vuoti.
        setFase('dentro');

        // Da qui in poi niente blocca piu' niente.
        loadTeamExtras().catch(e => console.error(e));
        if (scelto) {
          loadSectorData(scelto)
            .then(() => { if (vivo) { setSectorId(scelto); setCategoriaResa(scelto); } })
            .catch(e => { console.error(e); if (vivo) { setSectorId(scelto); setCategoriaResa(scelto); } });
        } else {
          setSectorId(null);
          setCategoriaResa(null);
        }
      } catch (e) {
        // Senza sessione, offline, o con Supabase irraggiungibile si finisce
        // sulle schermate d'accesso: da lì si riprova o si guarda l'app con i
        // dati di esempio. Una pagina bianca sarebbe l'unico esito davvero
        // inutile.
        //
        // MA se la sessione c'è, rimandare all'accesso è una bugia: la persona
        // è entrata, ed è il database che non ha risposto. È successo davvero
        // con la migrazione 046 — una policy che si richiamava da sola — e per
        // tutti sembrava «non mi fa più entrare», che è la diagnosi sbagliata.
        console.error(e);
        if (!vivo) return;
        let conSessione = false;
        try {
          const { supabase } = await import('../supabaseClient.js');
          const { data } = await supabase.auth.getSession();
          conSessione = !!(data && data.session);
        } catch (e2) { /* se non si sa, si ripiega sull'accesso */ }
        if (!vivo) return;
        if (conSessione) { setGuasto(e); setFase('guasto'); return; }
        setFase('accesso');
      } finally {
        clearTimeout(orologio);
      }
    })();
    return () => { vivo = false; clearTimeout(orologio); };
  }, []);

  /* Cambiare categoria.
   *
   * La pastiglia si muove SUBITO: quello e' il tocco, e un comando che aspetta
   * la rete prima di rispondere sembra rotto. Quello che aspetta sono i dati,
   * e mentre aspettano il contenuto di prima resta dov'e', smorzato.
   *
   * Prima veniva svuotato e al suo posto compariva lo scheletro — un lampo
   * bianco e un salto di altezza anche quando i dati arrivavano in duecento
   * millisecondi, cioe' quasi sempre.
   */
  /* L'anteprima con i dati di esempio.
   *
   * Sta nella console del SuperAdmin, e non sulla schermata d'accesso: serve
   * a far vedere l'app a un dirigente prima che la sua societa' esista.
   * Sull'accesso invitava un genitore a guardare una societa' inventata, e a
   * chi non sa dove sia finito faceva credere che i dati veri fossero quelli.
   */
  function apriCampione() {
    caricaCampione(state);
    setSectorId(state.activeSectorId);
    setCategoriaResa(state.activeSectorId);
    setCampione(true);
    setFase('dentro');
  }

  async function cambiaSettore(id) {
    state.activeSectorId = id;
    setSectorId(id);
    if (campione) { setCategoriaResa(id); return; }   // non c'è niente da ricaricare
    try { localStorage.setItem('bbapp_last_sector', id); } catch (e) { /* niente */ }

    const mia = ++richiestaCategoria.current;
    setScambioCategoria(true);
    // L'avviso di attesa solo se tarda davvero: sotto il mezzo secondo si
    // legge dopo che e' gia' sparito, ed e' piu' disturbo che informazione.
    const lento = setTimeout(() => {
      if (richiestaCategoria.current === mia) setAttesaLunga(true);
    }, 550);
    try {
      await loadSectorData(id);
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(lento);
      // Se nel frattempo se n'e' scelta un'altra, questa risposta non comanda
      // piu': a spegnere l'attesa ci pensa l'ultima arrivata.
      if (richiestaCategoria.current === mia) {
        setCategoriaResa(id);
        setScambioCategoria(false);
        setAttesaLunga(false);
      }
    }
  }

  if (fase === 'console') {
    return (
      <ConsoleSuperAdmin
        email={recupero.email}
        onIscriviti={() => setFase('completa')}
        onCampione={apriCampione}
      />
    );
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

  if (fase === 'guasto') {
    return <Guasto errore={guasto} onEsci={() => { logout(); window.location.reload(); }} />;
  }

  if (fase === 'attesa') {
    return <InAttesa onEsci={() => { logout(); window.location.reload(); }} />;
  }

  if (fase === 'accesso') {
    return (
      <ProvvederAvvisi>
        <Accesso onEntrato={() => window.location.reload()} />
      </ProvvederAvvisi>
    );
  }

  if (fase === 'carico') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <img className="marchio-simbolo h-[68px] w-auto animate-pulse" alt="" />
        <p className="mt-5 text-[13px] text-tenue">Sto aprendo la tua società…</p>

        {/* Quattro rettangoli vuoti non dicono se sta caricando o se si e'
            rotto qualcosa. Dopo dodici secondi la differenza va detta. */}
        {lento && (
          <div className="mt-7 max-w-[19rem]">
            <p className="text-[12.5px] leading-relaxed text-soffuso">
              Ci sta mettendo più del solito. Può essere la rete, o il database che si sta
              svegliando.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg vetro orlo px-4 py-2 text-[12.5px] font-semibold transition-colors hover:bg-pannello/12"
            >
              Riprova
            </button>
          </div>
        )}
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
  // Lo scheletro resta per il PRIMO caricamento, dove non c'e' ancora niente
  // da smorzare. Nei cambi successivi non serve piu': c'e' la schermata di
  // prima, ed e' un'informazione migliore di quattro rettangoli vuoti.
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
        nastro={
          ospite
            ? <NastroOspite societa={ospite} />
            : (campione ? <Nastro onIndietro={() => { setCampione(false); setFase('console'); }} /> : null)
        }
        chiaveContenuto={sezione + '|' + (categoriaResa || '')}
        strumenti={<Tema valore={tema} onCambia={setTema} />}
      >
        {/* Il riquadro c'e' sempre, anche quando non si aspetta niente:
            farlo comparire e sparire rimonterebbe la schermata dentro, che e'
            esattamente quello che questa modifica serve a evitare. */}
        <div
          className={cx('scambio-categoria', scambioCategoria && 'in-attesa')}
          aria-busy={scambioCategoria || undefined}
        >
          {contenuto}
        </div>
      </Guscio>

      {attesaLunga && (
        <div className="pillola-attesa rounded-full vetro-alto orlo px-4 py-2 text-[12.5px] font-semibold text-soffuso shadow-lg animate-salita">
          Carico la categoria…
        </div>
      )}
    </ProvvederAvvisi>
  );
}

/* Il guscio offline.
 *
 * Si registra SOLO nella versione pubblicata: in sviluppo si metterebbe in
 * mezzo al ricaricamento a caldo e si passerebbe il tempo a chiedersi perche'
 * una modifica non si vede.
 *
 * Il suo unico compito e' far aprire l'app dove non c'e' rete — in palestra,
 * dove c'e' una partita salvata sul dispositivo che aspetta di essere ripresa.
 * Va sempre in rete per primo: non serve a rendere l'app piu' veloce, serve a
 * non lasciarla chiusa.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('Guscio offline non registrato', e));
  });
}

// Con il ricaricamento a caldo Vite riesegue questo modulo, e un secondo
// createRoot sullo stesso nodo fa esplodere React durante lo sviluppo.
const nodo = document.getElementById('radice');
if (!nodo.__radice) nodo.__radice = createRoot(nodo);
nodo.__radice.render(<App />);
