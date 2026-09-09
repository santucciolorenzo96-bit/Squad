import React from 'react';
import { state } from '../state.js';
import { standingsPosition, computeRecord, computeTeamPPG } from '../utils/stats.js';
import { canEditHome } from '../utils/permissions.js';
import { Foglio, Etichetta, Titolo, Stato, Dato, Vuoto, cx } from './ui.jsx';

/* La Home.
 *
 * Non è un cruscotto: è la prima pagina di un giornale. C'è una notizia di
 * apertura — la prossima partita — che occupa lo spazio che merita, e sotto
 * le altre in ordine di importanza. Dodici riquadri tutti uguali sono la
 * confessione che nessuno ha deciso cosa conta.
 */

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

function giorniA(iso) {
  if (!iso) return null;
  const a = new Date(oggiISO() + 'T00:00:00');
  const b = new Date(iso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function dataLunga(iso) {
  if (!iso) return 'Data da definire';
  const d = new Date(iso + 'T00:00:00');
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('it-IT', { month: 'long' })}`;
}

function contoAllaRovescia(g) {
  if (g == null) return null;
  if (g < 0) return 'Risultato da inserire';
  if (g === 0) return 'Oggi';
  if (g === 1) return 'Domani';
  return `Fra ${g} giorni`;
}

/* --------------------------------------------------------- apertura: partita */
function Apertura({ partita }) {
  if (!partita) {
    return (
      <Foglio rilievo className="px-5 py-8">
        <Etichetta>Prossima partita</Etichetta>
        <div className="mt-4">
          <Vuoto>Il calendario è vuoto. Caricalo da Calendario e questa pagina si riempie da sola.</Vuoto>
        </div>
      </Foglio>
    );
  }

  const g = giorniA(partita.date);
  const casa = partita.home !== false;
  const posizione = standingsPosition(state.standings, partita.opponent);
  const mia = state.teamProfile ? standingsPosition(state.standings, state.teamProfile.name) : null;

  return (
    <Foglio rilievo className="overflow-hidden">
      <div className="flex items-center justify-between border-b riga px-4 py-2">
        <Etichetta>Prossima partita</Etichetta>
        <span className="cifra text-[11px] font-bold uppercase tracking-etichetta text-timbro">
          {contoAllaRovescia(g)}
        </span>
      </div>

      <div className="px-5 py-6">
        {/* I due nomi hanno lo stesso peso tipografico e il "vs" li separa
            piccolo in mezzo: è il modo in cui un tabellino stampa un incontro,
            e dice a colpo d'occhio che sono due squadre, non un titolo. */}
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-right">
            <div className="font-serif text-[clamp(20px,4.5vw,30px)] leading-tight">
              {casa ? (state.teamProfile || {}).name : partita.opponent}
            </div>
            <div className="etichetta mt-1">{casa ? 'in casa' : 'ospite'}</div>
          </div>
          <div className="cifra shrink-0 text-[13px] font-bold text-grafite">vs</div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[clamp(20px,4.5vw,30px)] leading-tight">
              {casa ? partita.opponent : (state.teamProfile || {}).name}
            </div>
            <div className="etichetta mt-1">{casa ? 'ospite' : 'in casa'}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t riga pt-4 text-[13px]">
          <span className="font-semibold">{dataLunga(partita.date)}</span>
          {partita.time && <span className="cifra text-grafite">{partita.time}</span>}
          {partita.location && <span className="text-grafite">{partita.location}</span>}
          {partita.giornata && <span className="cifra text-grafite">giornata {partita.giornata}</span>}
        </div>

        {(mia || posizione) && (
          <div className="mt-4 flex items-center justify-center gap-6 text-[12px] text-grafite">
            {mia && <span>Noi <b className="cifra text-inchiostro">{mia}ª</b></span>}
            {posizione && <span>Loro <b className="cifra text-inchiostro">{posizione}ª</b></span>}
          </div>
        )}
      </div>
    </Foglio>
  );
}

/* --------------------------------------------------------------- allenamento */
function ProssimoAllenamento() {
  const oggi = oggiISO();
  const t = [...state.trainings]
    .filter(x => x.date >= oggi)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <Foglio className="px-4 py-4">
      <Etichetta>Prossimo allenamento</Etichetta>
      {t ? (
        <>
          <div className="mt-2 font-serif text-[19px] leading-tight">{t.title}</div>
          <div className="mt-1 text-[12.5px] text-grafite">
            {dataLunga(t.date)}
            {t.start_time && <> · <span className="cifra">{t.start_time}{t.end_time ? `–${t.end_time}` : ''}</span></>}
          </div>
          {t.location && <div className="mt-0.5 text-[12.5px] font-semibold">{t.location}</div>}
        </>
      ) : (
        <p className="mt-3 font-serif italic text-[14px] text-grafite">Niente in programma.</p>
      )}
    </Foglio>
  );
}

/* ------------------------------------------------------------------- stagione */
function Stagione() {
  const record = computeRecord(state.history);
  const ppg = computeTeamPPG(state.history);
  const posizione = state.teamProfile ? standingsPosition(state.standings, state.teamProfile.name) : null;

  if (state.history.length === 0 && !posizione) return null;

  return (
    <Foglio className="px-4 py-4">
      <Etichetta>La stagione</Etichetta>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <div className="cifra text-[26px] font-bold leading-none">
            {state.history.length ? `${record.w}–${record.l}` : '—'}
          </div>
          <div className="etichetta mt-1.5">vinte–perse</div>
        </div>
        <div>
          <div className="cifra text-[26px] font-bold leading-none">{posizione ? `${posizione}ª` : '—'}</div>
          <div className="etichetta mt-1.5">in classifica</div>
        </div>
        <div>
          <div className="cifra text-[26px] font-bold leading-none">{ppg ? Math.round(ppg) : '—'}</div>
          <div className="etichetta mt-1.5">punti a partita</div>
        </div>
      </div>
    </Foglio>
  );
}

/* ------------------------------------------------------------------ da fare */
// Compare solo se c'è davvero qualcosa da fare. Un riquadro che dice "0" è
// rumore che occupa lo stesso spazio di una cosa vera.
function DaFare({ onSezione }) {
  const voci = [];
  if (state.pendingDocsCount > 0) {
    voci.push({ n: state.pendingDocsCount, testo: 'documenti da approvare', tono: 'attesa', vai: 'anagrafica' });
  }
  if (state.expiringDocsCount > 0) {
    voci.push({ n: state.expiringDocsCount, testo: 'certificati in scadenza', tono: 'fermo', vai: 'anagrafica' });
  }
  const daSegnare = state.calendar.filter(m => !m.played && m.date && m.date < oggiISO()).length;
  if (daSegnare > 0) {
    voci.push({ n: daSegnare, testo: 'partite senza risultato', tono: 'attesa', vai: 'calendario' });
  }
  if (voci.length === 0) return null;

  return (
    <Foglio className="px-4 py-4">
      <Etichetta>Da sistemare</Etichetta>
      <div className="mt-3 divide-y divide-matita/15">
        {voci.map((v, i) => (
          <button
            key={i}
            onClick={() => onSezione(v.vai)}
            className="flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0 hover:text-timbro"
          >
            <span className="cifra w-8 shrink-0 text-[21px] font-bold leading-none">{v.n}</span>
            <span className="flex-1 text-[13px]">{v.testo}</span>
            <Stato tono={v.tono}>apri</Stato>
          </button>
        ))}
      </div>
    </Foglio>
  );
}

/* ---------------------------------------------------------------------- Home */
export function Home({ onSezione }) {
  const utente = state.currentUser || {};
  const nome = (utente.display_name || '').trim().split(/\s+/)[0] || '';
  const ora = new Date().getHours();
  const saluto = ora < 5 ? 'Buonanotte' : ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const partita = state.calendar.length > 0
    ? [...state.calendar].filter(m => !m.played).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0] || null
    : state.nextMatch;

  const gestore = canEditHome(utente);

  return (
    <div className="space-y-5">
      {/* La testatina: saluto in serif, data in maiuscoletto. È l'unico punto
          della schermata in cui l'app parla, quindi parla italiano vero. */}
      <div className="flex items-baseline justify-between gap-3 border-b-2 riga pb-3">
        <h1 className="font-serif text-[clamp(24px,5vw,34px)] leading-none">
          {saluto}{nome && <>, {nome}</>}
        </h1>
        <div className="etichetta shrink-0">{oggi}</div>
      </div>

      <Apertura partita={partita} />

      <div className="grid gap-4 md:grid-cols-2">
        <ProssimoAllenamento />
        <Stagione />
        {gestore && <DaFare onSezione={onSezione} />}
      </div>
    </div>
  );
}
