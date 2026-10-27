import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { Croce } from './icone.jsx';
import { removePlayerFromSector, fetchPlayerPhotoUrls } from '../api/roster.js';
import { canEditRoster, managesSector } from '../utils/permissions.js';
import { computeSeasonStats, findSeasonRow } from '../utils/stats.js';
import { currentSport } from '../utils/sports/index.js';
import { inCampione } from './campione.js';
import { Etichetta, Titolo, Vuoto, Scheletro, Avatar, cx, AzioneRiga } from './ui.jsx';
import { Conferma, useAvviso } from './moduli.jsx';
import { dividiNome } from '../utils/format.js';
import { SchedaAtleta } from './SchedaAtleta.jsx';

/* LA ROSA.
 *
 * Un elenco di slot, uno per giocatore, e niente altro.
 *
 * Sopra c'era un campo con cinque gettoni trascinabili e una panchina: si
 * componeva una formazione muovendo le facce, con il trascinamento col dito e
 * il tocco su ⇄ per scambiare due giocatori. Era la cosa più viva della
 * pagina, e occupava la prima schermata intera.
 *
 * NON DECIDEVA NIENTE. Quel quintetto viveva in uno stato di React e non
 * veniva salvato da nessuna parte: cambiando sezione svaniva, e nessun altro
 * punto del programma lo leggeva. Da quando i titolari si scelgono nello scout
 * — dove c'è la partita da guardare, e dove quella scelta serve — non
 * alimentava più nemmeno quello.
 *
 * Un comando che sembra decidere e non decide è peggio di un comando che non
 * c'è: chi lo usa crede di aver fatto una cosa, e scopre che non l'ha fatta
 * nel momento in cui conta. È la stessa forma delle sottocategorie dei settori
 * e del permesso sul caricamento dei documenti, e la risposta è la stessa: si
 * toglie, invece di farla funzionare per metà.
 *
 * È sparita con lui anche la pastiglia «in campo» sugli slot, che leggeva quel
 * quintetto: diceva «questi cinque sono in campo» di una formazione che
 * nessuno aveva deciso.
 *
 * Quello che resta è quello per cui si apre questa pagina: chi c'è, com'è
 * fatto, e come sta andando.
 */

function medie(riga, sport) {
  if (!riga || !riga.games) return sport.headline.map(h => ({ short: h.short, v: '—' }));
  return sport.headline.map(h => ({
    short: h.short,
    v: ((riga[h.key] || 0) / riga.games).toFixed(1)
  }));
}

/* L'ANNO DI NASCITA, NON L'ETÀ.
 *
 * Nel settore giovanile l'anno è la categoria: «un 2011» si dice e si capisce,
 * e due atleti dello stesso anno sono confrontabili anche a dieci mesi di
 * distanza. L'età in anni cambia a ogni compleanno e costringe a fare il conto
 * all'indietro per sapere se uno è fuori quota.
 */
function annoDiNascita(p) {
  const d = String((p && p.birth_date) || '').trim();
  return /^\d{4}/.test(d) ? d.slice(0, 4) : '';
}

/* UNO SLOT DELLA ROSA.
 *
 * Quadrato, e il quadrato non è un gusto: è quello che permette di mettere sei
 * cose nello stesso riquadro senza stringerne nessuna. Dall'alto in basso — il
 * numero, la faccia, nome e cognome, ruolo e anno, le tre medie — e ognuna
 * nello stesso punto in ogni slot, perché è scorrendo l'occhio in verticale
 * che si confronta una rosa.
 *
 * Il cognome in grassetto sotto il nome: in una rosa con due Giulia il cognome
 * è l'identificatore, e va trovato sempre alla stessa altezza.
 *
 * Ruolo e anno su UNA riga sola, separati da un punto: sono due dati brevi, e
 * due righe per due parole allontanerebbero le medie dal nome senza aggiungere
 * niente.
 *
 * Su telefono il riquadro è un po' più alto che largo. Con sei informazioni un
 * quadrato esatto di centosessanta pixel costringerebbe a rimpicciolire la
 * faccia o a troncare il ruolo, e tutte e due le cose sono peggio di un
 * rettangolo appena più alto. Da tablet in su lo spazio c'è, e il quadrato
 * torna quadrato.
 *
 * «Togli» sta FUORI dal riquadro che si tocca — HTML non permette un pulsante
 * dentro un pulsante, ed è una buona regola anche per le dita: il riquadro si
 * tocca per aprire la scheda, e un bersaglio distruttivo dentro un bersaglio
 * che si tocca spesso è un bersaglio premuto per sbaglio.
 */
function SlotGiocatore({ p, foto, sport, riga, puoiModificare, onApri, onTogli }) {
  const { nome, cognome } = dividiNome(p.name);
  const voci = medie(riga, sport);
  const anno = annoDiNascita(p);
  const sotto = [p.role_position, anno].filter(Boolean).join(' · ');

  return (
    <div className="relative">
      <button
        onClick={onApri}
        title={p.name}
        className={cx(
          'flex aspect-[5/6] w-full flex-col items-center gap-1.5 rounded-2xl p-3 text-center',
          'vetro orlo transition-all hover:bg-pannello/10 active:scale-[0.99] sm:aspect-square'
        )}
      >
        {/* Il numero a sinistra, e a destra lo spazio del «Togli» — tenuto
            libero anche per chi non lo vede, così il numero sta nello stesso
            punto per tutti. */}
        <div className="flex w-full shrink-0 items-start justify-between gap-1">
          <span className="cifra text-[21px] font-bold leading-none">{p.number}</span>
          {puoiModificare && <span className="w-6 shrink-0" aria-hidden="true" />}
        </div>

        <Avatar nome={p.name} url={foto} dim={54} />

        <div className="min-w-0 w-full">
          <div className="truncate text-[11.5px] leading-tight text-tenue">{nome}</div>
          <div className="truncate text-[14px] font-bold leading-tight">{cognome || nome}</div>
          {sotto && (
            <div className="mt-1 truncate text-[10.5px] leading-tight text-tenue">{sotto}</div>
          )}
        </div>

        {/* Le medie in fondo, spinte in basso da `mt-auto`: con un ruolo scritto
            o mancante, e con un cognome lungo o corto, la riga dei numeri resta
            alla stessa altezza in tutti gli slot. */}
        <div className="mt-auto flex w-full shrink-0 items-end justify-around gap-1 border-t border-bordo/8 pt-2">
          {voci.map(m => (
            <span key={m.short} className="min-w-0">
              <b className="cifra block text-[14.5px] font-bold leading-none">{m.v}</b>
              <i className="mt-0.5 block text-[9px] font-bold uppercase not-italic leading-none tracking-etichetta text-tenue">
                {m.short}
              </i>
            </span>
          ))}
        </div>
      </button>

      {puoiModificare && (
        <div className="absolute right-1.5 top-1.5">
          <AzioneRiga etichetta="Togli" pericolo onClick={onTogli}>
            <Croce />
          </AzioneRiga>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Rosa */
export function Rosa() {
  const sport = currentSport();

  const [foto, setFoto] = useState({});
  const [caricato, setCaricato] = useState(false);
  const [scheda, setScheda] = useState(null);
  const [daRimuovere, setDaRimuovere] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditRoster(state.currentUser)
    && managesSector(state.currentUser, state.activeSectorId, state.staffSectors);
  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    if (rosa.length === 0 || inCampione()) { setCaricato(true); return undefined; }
    fetchPlayerPhotoUrls(rosa).catch(() => ({})).then(f => {
      if (vivo) { setFoto(f); setCaricato(true); }
    });
    return () => { vivo = false; };
  }, [rosa]);

  const stagione = computeSeasonStats(state.history, sport);

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={<span className="shrink-0 text-[12.5px] text-tenue">{rosa.length} in rosa</span>}
      >
        Rosa
      </Titolo>

      {!caricato ? (
        <Scheletro righe={5} />
      ) : rosa.length === 0 ? (
        <Vuoto>
          Nessun giocatore in questa categoria. I giocatori si aggiungono dall’Anagrafica,
          che è dove stanno i loro dati.
        </Vuoto>
      ) : (
        <div>
          <Etichetta className="mb-2.5">Tutti i giocatori</Etichetta>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rosa.map(p => (
              <SlotGiocatore
                key={p.id}
                p={p}
                foto={foto[p.id]}
                sport={sport}
                riga={findSeasonRow(stagione, p)}
                puoiModificare={puoiModificare}
                onApri={() => setScheda(p)}
                onTogli={() => setDaRimuovere(p)}
              />
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Le tre medie sono della stagione, a partita. Tocca uno slot per la scheda completa:
            statistiche, documenti e andamento.
          </p>
        </div>
      )}

      {scheda && <SchedaAtleta playerId={scheda.id} onChiudi={() => setScheda(null)} />}

      {daRimuovere && (
        <Conferma
          titolo="Togliere dalla categoria?"
          testo={`${daRimuovere.name} esce da questa categoria. La sua scheda, i documenti e lo storico restano: non viene cancellato niente.`}
          etichetta="Togli"
          onChiudi={() => setDaRimuovere(null)}
          onConferma={async () => {
            await removePlayerFromSector(daRimuovere.id, state.activeSectorId, state.activeSeasonId);
            state.roster = state.roster.filter(x => x.id !== daRimuovere.id);
            ridisegna(n => n + 1);
            avvisa('Giocatore tolto dalla categoria');
          }}
        />
      )}
    </div>
  );
}
