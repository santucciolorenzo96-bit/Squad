import React from 'react';
import { state } from '../state.js';
import { standingsPosition, computeRecord, computeTeamPPG } from '../utils/stats.js';
import { canEditHome } from '../utils/permissions.js';
import { Pannello, Etichetta, Stato, Vuoto, Titolo, Pulsante, cx } from './ui.jsx';
import { IconaSezione, Chevron } from './icone.jsx';

/* La Home.
 *
 * Un cruscotto non è "tutti i numeri disponibili disposti in griglia": è una
 * gerarchia. C'è una cosa che conta più delle altre — la prossima partita — e
 * prende il posto, l'alone e il livello di profondità che merita. Le altre
 * stanno sotto, sullo stesso piano fra loro.
 */

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

const oggiISO = () => new Date().toISOString().slice(0, 10);

function giorniA(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T00:00:00') - new Date(oggiISO() + 'T00:00:00')) / 86400000);
}

function dataLunga(iso) {
  if (!iso) return 'Data da definire';
  const d = new Date(iso + 'T00:00:00');
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('it-IT', { month: 'long' })}`;
}

/* ---------------------------------------------------- apertura: la partita */
function Apertura({ partita, onSezione }) {
  if (!partita) {
    return (
      <Pannello alto className="px-5 py-7">
        <Etichetta>Prossima partita</Etichetta>
        <div className="mt-4">
          <Vuoto>Il calendario è vuoto. Caricalo dalla sezione Calendario e questa scheda si riempie da sola.</Vuoto>
        </div>
      </Pannello>
    );
  }

  const g = giorniA(partita.date);
  const casa = partita.home !== false;
  const scaduta = g != null && g < 0;
  const noi = (state.teamProfile || {}).name || 'Noi';
  const posLoro = standingsPosition(state.standings, partita.opponent);
  const posNoi = standingsPosition(state.standings, noi);

  // Una partita passata e mai segnata non è "giocata": è da fare, ed è
  // esattamente il caso che non deve passare inosservato.
  const conto = scaduta ? 'Risultato da inserire'
    : g === 0 ? 'Oggi' : g === 1 ? 'Domani' : g != null ? `Fra ${g} giorni` : null;

  return (
    <Pannello alto className="relative overflow-hidden">
      {/* L'alone dietro: è l'unico pannello che ce l'ha, ed è così che si
          capisce da lontano qual è la notizia della schermata. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-70"
        style={{
          background:
            'radial-gradient(28rem 16rem at 22% -20%, rgb(var(--blu) / .30), transparent 62%),' +
            'radial-gradient(24rem 14rem at 86% 0%, rgb(var(--viola) / .26), transparent 62%)'
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-bordo/10 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <IconaSezione id="partita" dim={22} />
            <Etichetta>Prossima partita</Etichetta>
          </div>
          <Stato tono={scaduta ? 'fermo' : (g != null && g <= 1 ? 'attesa' : 'neutro')}>{conto}</Stato>
        </div>

        <div className="px-4 py-6 sm:px-6 sm:py-8">
          {/* I due nomi hanno lo stesso peso: sono due squadre, non un titolo
              e un sottotitolo. Il "vs" li separa piccolo in mezzo. */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="min-w-0 flex-1 text-right">
              <div className="text-[clamp(17px,4vw,26px)] font-extrabold leading-tight tracking-tight">
                {casa ? noi : partita.opponent}
              </div>
              <Etichetta className="mt-1.5">{casa ? 'in casa' : 'ospite'}</Etichetta>
            </div>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full vetro orlo text-[11px] font-bold text-tenue">
              vs
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[clamp(17px,4vw,26px)] font-extrabold leading-tight tracking-tight">
                {casa ? partita.opponent : noi}
              </div>
              <Etichetta className="mt-1.5">{casa ? 'ospite' : 'in casa'}</Etichetta>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-bordo/10 pt-4 text-[12.5px]">
            <span className="font-semibold">{dataLunga(partita.date)}</span>
            {partita.time && <span className="cifra text-soffuso">{partita.time}</span>}
            {partita.location && <span className="text-soffuso">{partita.location}</span>}
            {partita.giornata && <span className="cifra text-tenue">giornata {partita.giornata}</span>}
          </div>

          {(posNoi || posLoro) && (
            <div className="mt-4 flex items-center justify-center gap-7 text-[12px] text-tenue">
              {posNoi && <span>Noi <b className="cifra text-testo">{posNoi}ª</b></span>}
              {posLoro && <span>Loro <b className="cifra text-testo">{posLoro}ª</b></span>}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Pulsante variante="primario" onClick={() => onSezione('calendario')}>
              Vedi il calendario <Chevron dim={14} />
            </Pulsante>
          </div>
        </div>
      </div>
    </Pannello>
  );
}

/* ------------------------------------------------------------- allenamento */
function ProssimoAllenamento({ onSezione }) {
  const t = [...state.trainings]
    .filter(x => x.date >= oggiISO())
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <Pannello className="px-4 py-4">
      <div className="flex items-center gap-2">
        <IconaSezione id="allenamenti" dim={22} />
        <Etichetta>Prossimo allenamento</Etichetta>
      </div>
      {t ? (
        <button onClick={() => onSezione('allenamenti')} className="mt-3 block w-full text-left">
          <div className="text-[17px] font-bold leading-tight">{t.title}</div>
          <div className="mt-1.5 text-[12.5px] text-soffuso">
            {dataLunga(t.date)}
            {t.start_time && <> · <span className="cifra">{t.start_time}{t.end_time ? `–${t.end_time}` : ''}</span></>}
          </div>
          {t.location && <div className="mt-1 text-[12.5px] font-semibold text-testo">{t.location}</div>}
        </button>
      ) : (
        <p className="mt-3 text-[13px] text-tenue">Niente in programma.</p>
      )}
    </Pannello>
  );
}

/* ---------------------------------------------------------------- stagione */
function Stagione() {
  const record = computeRecord(state.history);
  const ppg = computeTeamPPG(state.history);
  const pos = state.teamProfile ? standingsPosition(state.standings, state.teamProfile.name) : null;
  if (state.history.length === 0 && !pos) return null;

  const celle = [
    { v: state.history.length ? `${record.w}–${record.l}` : '—', e: 'vinte–perse' },
    { v: pos ? `${pos}ª` : '—', e: 'in classifica' },
    { v: ppg ? Math.round(ppg) : '—', e: 'punti a partita' }
  ];

  return (
    <Pannello className="px-4 py-4">
      <div className="flex items-center gap-2">
        <IconaSezione id="statistiche" dim={22} />
        <Etichetta>La stagione</Etichetta>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {celle.map((c, i) => (
          <div key={i}>
            <div className="cifra text-[24px] font-extrabold leading-none tracking-tight">{c.v}</div>
            <Etichetta className="mt-2">{c.e}</Etichetta>
          </div>
        ))}
      </div>
    </Pannello>
  );
}

/* ----------------------------------------------------------- da sistemare */
// Compare solo se c'è davvero qualcosa da fare: un pannello che dice zero
// occupa lo stesso spazio di uno che dice una cosa vera.
function DaSistemare({ onSezione }) {
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
    <Pannello className="px-4 py-4">
      <div className="flex items-center gap-2">
        <IconaSezione id="situazione" dim={22} />
        <Etichetta>Da sistemare</Etichetta>
      </div>
      <div className="mt-2 divide-y divide-bordo/8">
        {voci.map((v, i) => (
          <button
            key={i}
            onClick={() => onSezione(v.vai)}
            className="group flex w-full items-center gap-3 py-2.5 text-left"
          >
            <span className={cx('cifra w-8 shrink-0 text-[20px] font-extrabold leading-none',
              v.tono === 'fermo' ? 'text-rosso' : 'text-ambra')}>
              {v.n}
            </span>
            <span className="flex-1 text-[13px] text-soffuso group-hover:text-testo">{v.testo}</span>
            <Chevron dim={15} className="shrink-0 text-tenue transition-transform group-hover:translate-x-0.5 group-hover:text-testo" />
          </button>
        ))}
      </div>
    </Pannello>
  );
}

/* -------------------------------------------------------------------- Home */
export function Home({ onSezione }) {
  const utente = state.currentUser || {};
  const nome = (utente.display_name || '').trim().split(/\s+/)[0] || '';
  const ora = new Date().getHours();
  const saluto = ora < 5 ? 'Buonanotte' : ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const partita = state.calendar.length > 0
    ? [...state.calendar].filter(m => !m.played).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0] || null
    : state.nextMatch;

  return (
    <div className="space-y-5">
      <Titolo sopra={oggi}>{saluto}{nome && <>, {nome}</>}</Titolo>

      <Apertura partita={partita} onSezione={onSezione} />

      <div className="grid gap-4 md:grid-cols-2">
        <ProssimoAllenamento onSezione={onSezione} />
        <Stagione />
        {canEditHome(utente) && <DaSistemare onSezione={onSezione} />}
      </div>
    </div>
  );
}
