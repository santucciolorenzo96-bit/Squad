import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { currentSport } from '../utils/sports/index.js';
import { refertoPartita, tabellaTabellino, quota, legendaColonne } from '../utils/referto.js';
import { generaRefertoPdf } from '../utils/refertoPdf.js';
import { downloadCsv, safeName } from '../utils/csv.js';
import { sectorFullName } from '../utils/sectors.js';
import { canDeleteGame, canFixGame, ORE_PER_CORREGGERE } from '../utils/permissions.js';
import { reopenGameForFix, fetchGameCorrections } from '../api/games.js';
import { deleteGame } from '../api/games.js';
import { inCampione } from './campione.js';
import { Etichetta, Pannello, Pulsante, Vuoto, cx } from './ui.jsx';
import { Finestra, Conferma, useAvviso } from './moduli.jsx';

/* Il referto di una partita archiviata.
 *
 * Fino a ieri quello che lo scout raccoglieva durante la partita si poteva
 * leggere solo mentre la partita era aperta: chiusa, restava nel database e
 * spariva dalla vista. Qui torna, e torna intero — i set con le loro fasi, le
 * rotazioni, il tabellino — con due modi per portarlo fuori.
 *
 * L'ordine è quello in cui lo si legge: prima com'è finita, poi perché.
 */

/* Un numero grande con la sua etichetta sotto. Quattro in fila: si leggono
   come si legge un cruscotto, non come una frase. */
/* La mappa dei tiri.
 *
 * Il campo con sopra i tiri: pieno verde quelli entrati, cerchio vuoto rosso
 * quelli sbagliati. Due forme diverse e non due colori soltanto, perche' una
 * mappa letta da chi non distingue bene i colori deve restare leggibile.
 *
 * Sotto, le tre zone in cifre: la mappa dice dove si e' tirato, le cifre
 * dicono come e' andata. Serve tutte e due, perche' un grappolo fitto di
 * pallini sotto canestro puo' voler dire che ci si va spesso o che ci si
 * sbaglia spesso, e a occhio non si distingue.
 */
function MappaTiri({ sport, tiri }) {
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">Da dove abbiamo tirato</Etichetta>

      <Pannello alto className="overflow-hidden">
        <div className="campo-cornice" style={{ '--proporzione': sport.field.ratio }}>
          <div className="campo parquet relative w-full">
            <div className="righe-campo" dangerouslySetInnerHTML={{ __html: sport.field.svg }} />
            {tiri.punti.map((t, i) => (
              <span
                key={i}
                style={{ left: t.x + '%', top: t.y + '%' }}
                className={cx(
                  'absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                  t.dentro ? 'bg-verde ring-1 ring-white/50' : 'border-[1.6px] border-rosso'
                )}
              />
            ))}
          </div>
        </div>
      </Pannello>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {tiri.zone.map(z => (
          <Pannello key={z.key} className="px-3 py-2.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">{z.label}</div>
            <div className="cifra mt-1 text-[18px] font-bold leading-none">{z.quota}%</div>
            <div className="cifra mt-1 text-[11.5px] text-tenue">{z.fatti}/{z.tentati}</div>
          </Pannello>
        ))}
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Pieno verde i tiri entrati, cerchio vuoto quelli sbagliati. La zona non è scritta da
        nessuna parte: si ricava dal punto, arco da tre e angoli compresi.
      </p>
    </div>
  );
}

/* LE TRAIETTORIE DEI PUNTI.
 *
 * Il campo intero con sopra le righe: da dove e' partita la palla, dove e'
 * caduta. Il pallino pieno e' la partenza, la punta e' l'arrivo.
 *
 * Righe sottili e semitrasparenti apposta: quando dodici punti partono dalla
 * stessa zona, la sovrapposizione diventa una macchia piu' scura, e quella
 * macchia e' l'informazione. Con righe piene e opache sarebbe un gomitolo
 * in cui non si distingue niente.
 */
function Traiettorie({ sport, linee }) {
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">Dove sono caduti i punti</Etichetta>

      <Pannello alto className="overflow-hidden">
        <div className="campo-cornice" style={{ '--proporzione': sport.campoInteroRatio }}>
          <div className="campo parquet relative w-full">
            <div className="righe-campo" dangerouslySetInnerHTML={{ __html: sport.campoIntero }} />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {linee.map((t, i) => (
                <g key={i}>
                  <line
                    x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                    stroke="rgb(var(--verde))" strokeOpacity="0.55" strokeWidth="1"
                    strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  />
                  {/* Il cerchio non si deforma con il campo: `preserveAspectRatio
                      none` stira tutto, e un pallino diventerebbe un'ellisse. */}
                  <circle cx={t.x1} cy={t.y1} r="0.9" fill="rgb(var(--verde))" fillOpacity="0.8" />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </Pannello>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        {linee.length} {linee.length === 1 ? 'punto disegnato' : 'punti disegnati'}. Il pallino è da
        dove è partita la palla, la punta dove è caduta. Dove le righe si sovrappongono si è
        segnato più volte nello stesso modo — e se gli avversari non l’hanno mai coperto,
        si vede da qui.
      </p>
    </div>
  );
}

/* LE STESSE TRAIETTORIE, MA DI CHI.
 *
 * La mappa di squadra risponde a «dove cadono i nostri punti»: è una domanda
 * buona, ma non è quella che ci si fa guardando un referto. Quella è «dove
 * attacca la 4» — e un allenatore avversario la prepara per nome.
 *
 * Campi piccoli e affiancati, non uno grande per volta: il confronto è il
 * punto. Due attaccanti che colpiscono sempre nello stesso metro si vedono
 * mettendo le due mappe una accanto all'altra, non sfogliandole.
 */
function TraiettoriePerAtleta({ sport, righe }) {
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">Dove attacca ciascuno</Etichetta>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {righe.map(r => (
          <Pannello key={r.id} className="overflow-hidden">
            <div className="campo-cornice" style={{ '--proporzione': sport.campoInteroRatio }}>
              <div className="campo parquet relative w-full">
                <div className="righe-campo" dangerouslySetInnerHTML={{ __html: sport.campoIntero }} />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {r.linee.map((t, i) => (
                    <g key={i}>
                      <line
                        x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                        stroke="rgb(var(--verde))" strokeOpacity="0.6" strokeWidth="1"
                        strokeLinecap="round" vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={t.x1} cy={t.y1} r="1.1" fill="rgb(var(--verde))" fillOpacity="0.85" />
                    </g>
                  ))}
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2 px-2.5 py-2">
              <span className="cifra shrink-0 text-[13px] font-bold text-soffuso">{r.numero}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-tight">
                {r.nome}
              </span>
              <span className="cifra shrink-0 text-[12px] text-tenue">{r.linee.length}</span>
            </div>
          </Pannello>
        ))}
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Il numero a destra è quante palle ha giocato con la traiettoria segnata. Le mappe
        sono affiancate apposta: due attaccanti che colpiscono sempre nello stesso metro si
        vedono confrontandole, non sfogliandole una per volta.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- la ciambella */
/* La percentuale dentro il cerchio, i due conteggi accanto.
 *
 * L'anello e' la percentuale e basta: niente fette, niente legenda. Una fetta
 * vuole due colori e due etichette per dire quello che una percentuale dice
 * con un numero, e in un referto che si guarda di corsa il numero vince.
 *
 * Cosa siano i due conteggi lo decide lo sport: «segnati / sbagliati» nel
 * basket, «vincenti / errori» nella pallavolo. Qui arrivano gia' scritti.
 */
/* Il numeratore dell'anello, che non e' sempre il primo dei due conteggi
 * scritti accanto: nel servizio l'anello dice la positivita' — ace piu'
 * servizi rimasti in gioco — mentre accanto ci vanno gli ace e gli errori.
 * Chi definisce la ciambella lo dichiara in `v`; senza, vale il primo. */
function numeratore(voce) {
  if (!voce) return 0;
  if (voce.v != null) return voce.v;
  return (voce.righe && voce.righe[0]) ? voce.righe[0][0] : 0;
}

function Ciambella({ voce, dim = 66, spesso = 7 }) {
  const raggio = (dim - spesso) / 2;
  const giro = 2 * Math.PI * raggio;
  const quota = voce.pct == null ? 0 : voce.pct;

  return (
    <div className="flex items-center gap-3">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="shrink-0" aria-hidden="true">
        <circle cx={dim / 2} cy={dim / 2} r={raggio} fill="none"
          stroke="rgb(var(--pannello) / 0.18)" strokeWidth={spesso} />
        {voce.tot > 0 && voce.pct != null && (
          <circle cx={dim / 2} cy={dim / 2} r={raggio} fill="none"
            stroke="rgb(var(--verde))" strokeWidth={spesso} strokeLinecap="round"
            strokeDasharray={`${(giro * quota) / 100} ${giro}`}
            transform={`rotate(-90 ${dim / 2} ${dim / 2})`} />
        )}
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          className="cifra" fill="rgb(var(--testo))"
          style={{ fontSize: dim * 0.28 + 'px', fontWeight: 700 }}>
          {voce.pct == null ? '\u2014' : voce.pct + '%'}
        </text>
      </svg>

      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold leading-tight text-soffuso">{voce.etichetta}</div>
        {voce.righe.map(([n, parola], i) => (
          <div key={parola} className="mt-1 text-[12.5px] leading-tight">
            <span className={cx('cifra font-bold', i === 0 ? 'text-verde' : 'text-soffuso')}>{n}</span>
            <span className="text-tenue"> {parola}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// La stessa cosa in piccolo, per la griglia dei periodi: qui lo spazio per una
// sola cifra c'e', per due no.
function Pastiglia({ voce, dim = 40 }) {
  const spesso = 5;
  const raggio = (dim - spesso) / 2;
  const giro = 2 * Math.PI * raggio;
  const quota = voce && voce.pct != null ? voce.pct : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <circle cx={dim / 2} cy={dim / 2} r={raggio} fill="none"
          stroke="rgb(var(--pannello) / 0.18)" strokeWidth={spesso} />
        {voce && voce.tot > 0 && voce.pct != null && (
          <circle cx={dim / 2} cy={dim / 2} r={raggio} fill="none"
            stroke="rgb(var(--verde))" strokeWidth={spesso} strokeLinecap="round"
            strokeDasharray={`${(giro * quota) / 100} ${giro}`}
            transform={`rotate(-90 ${dim / 2} ${dim / 2})`} />
        )}
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          className="cifra" fill="rgb(var(--testo))"
          style={{ fontSize: dim * 0.3 + 'px', fontWeight: 700 }}>
          {voce && voce.pct != null ? voce.pct : '\u2014'}
        </text>
      </svg>
      <span className="cifra text-[10.5px] leading-none text-tenue">
        {voce && voce.tot ? numeratore(voce) + '/' + voce.tot : '\u2014'}
      </span>
    </div>
  );
}

/* I FONDAMENTALI, IN ANELLI.
 *
 * Quali siano lo dice lo sport: nel basket sono le quattro percentuali al
 * tiro, nella pallavolo sono attacco, ricezione, difesa e servizio. Il
 * componente non sa niente di nessuno dei due — riceve un elenco di
 * { etichetta, pct, righe } e lo disegna.
 *
 * E' il motivo per cui il referto della pallavolo non mostra piu' i rimbalzi a
 * zero: non e' un caso da escludere, e' una cosa che non esiste in quel gioco.
 */
function Fondamentali({ voci, perPeriodo, nomePeriodo, titolo }) {
  const quanti = voci.length;
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">{titolo}</Etichetta>

      <Pannello alto className="px-4 py-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
          {voci.map(v => <Ciambella key={v.etichetta} voce={v} />)}
        </div>
      </Pannello>

      {/* Periodo per periodo. Serve a rispondere a «dove si e' fermata»: una
          squadra al 45% in tutta la partita puo' averlo fatto con un terzo
          quarto al 20%, e quel terzo quarto e' tutta la storia. */}
      {perPeriodo && perPeriodo.length > 0 && perPeriodo.some(Boolean) && (
        <>
          <Etichetta className="mb-2 mt-4">
            {nomePeriodo === 'set' ? 'Set per set' : 'Periodo per periodo'}
          </Etichetta>
          <Pannello className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 6 + quanti * 5 + 'rem' }}>
                <thead>
                  <tr className="border-b border-bordo/10">
                    <th className="etichetta px-3 py-2.5 text-left">{nomePeriodo}</th>
                    {voci.map(v => (
                      <th key={v.etichetta} className="etichetta px-2 py-2.5 text-center">{v.etichetta}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perPeriodo.map((p, i) => (
                    <tr key={i} className="border-b border-bordo/6 last:border-b-0">
                      <td className="cifra px-3 py-2.5 text-[13px] font-bold text-tenue">{i + 1}º</td>
                      {voci.map((v, k) => (
                        <td key={v.etichetta} className="px-2 py-2">
                          <div className="flex justify-center">
                            <Pastiglia voce={p ? p[k] : null} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Pannello>
        </>
      )}
    </div>
  );
}

/* I conteggi.
 *
 * Numeri e basta, in una griglia che si adatta a quanti sono: otto nel basket,
 * otto nella pallavolo, ma il componente non li conta — li dispone.
 */
function Riepilogo({ voci }) {
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">I numeri di squadra</Etichetta>
      <Pannello className="grid grid-cols-2 gap-y-4 px-4 py-4 sm:grid-cols-4">
        {voci.map(v => (
          <div key={v.etichetta} className="min-w-0 px-1 text-center">
            <div className={cx('cifra text-[21px] font-bold leading-none',
              v.tono === 'rosso' ? 'text-rosso' : 'text-testo')}>
              {v.valore}
            </div>
            <div className="mt-1.5 text-[11px] leading-tight text-tenue">{v.etichetta}</div>
          </div>
        ))}
      </Pannello>
    </div>
  );
}

/* L'andamento.
 *
 * Due numeri che nei totali non esistono. Il massimo vantaggio dice quanto
 * siamo stati avanti davvero — una partita vinta di tre può essere stata di
 * quindici a metà terzo quarto. Il parziale dice quando è girata: sette punti
 * di fila subiti sono il momento da rivedere a video, e nel tabellino non
 * lasciano traccia.
 */
function Andamento({ a }) {
  return (
    <div className="mb-6">
      <Etichetta className="mb-2.5">Come è andata</Etichetta>
      <Pannello className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
        <Numero valore={'+' + a.maxVantaggio} etichetta="Massimo vantaggio" tono={a.maxVantaggio > 0 ? 'verde' : null} />
        <Numero valore={a.maxSvantaggio ? '−' + a.maxSvantaggio : '0'} etichetta="Massimo svantaggio" tono={a.maxSvantaggio > 0 ? 'rosso' : null} />
        <Numero valore={a.parzialeNostro} etichetta="Parziale nostro" tono={a.parzialeNostro >= a.parzialeLoro ? 'verde' : null} />
        <Numero valore={a.parzialeLoro} etichetta="Parziale subito" tono={a.parzialeLoro > a.parzialeNostro ? 'rosso' : null} />
      </Pannello>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Il parziale è il numero di punti fatti di fila senza che l'altra squadra rispondesse:
        è il momento in cui la partita è girata, e nel tabellino non lascia traccia.
      </p>
    </div>
  );
}

/* CON QUALI CINQUE SIAMO ANDATI MEGLIO.
 *
 * Il dato e' semplice — quanti punti ha guadagnato la squadra con quei
 * cinque in campo — e la vecchia versione lo rendeva difficile: un elenco
 * di righe tutte uguali, cinque numeri di maglia e una cifra col segno,
 * senza niente che dicesse quale fosse la risposta.
 *
 * Qui la risposta e' la prima cosa: UN quintetto, grande, con scritto in
 * parole cosa ha fatto. Gli altri vengono dopo, e si confrontano con una
 * barra invece che con dei numeri — perche' la domanda vera non e' «quanto
 * fa +3», e' «chi va meglio di chi», e quella a una barra si risponde
 * guardandola.
 *
 * La barra parte dal centro: a destra in verde chi ha guadagnato, a
 * sinistra in rosso chi ha perso terreno. Un quintetto sotto di cinque e uno
 * sopra di cinque sono due cose opposte, e su una barra che cresce sempre da
 * sinistra sembrerebbero due gradazioni della stessa.
 */
function BarraSaldo({ saldo, max }) {
  const quota = Math.min(50, (Math.abs(saldo) / (max || 1)) * 50);
  return (
    <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-pannello/12">
      <span className="absolute inset-y-0 left-1/2 w-px bg-bordo/30" aria-hidden="true" />
      <span
        className={cx('absolute inset-y-0 rounded-full', saldo >= 0 ? 'bg-verde' : 'bg-rosso')}
        style={saldo >= 0
          ? { left: '50%', width: quota + '%' }
          : { right: '50%', width: quota + '%' }}
      />
    </div>
  );
}

function Maglie({ nomi }) {
  return (
    <span className="flex flex-wrap gap-1">
      {nomi.map((n, i) => (
        <span key={i} className="cifra rounded-md bg-pannello/14 px-1.5 py-0.5 text-[12.5px] font-bold text-soffuso">
          {n}
        </span>
      ))}
    </span>
  );
}

function Quintetti({ quintetti }) {
  const migliore = quintetti[0];
  const altri = quintetti.slice(1);
  const max = Math.max(1, ...quintetti.map(q => Math.abs(q.saldo)));
  const tono = (v) => (v > 0 ? 'text-verde' : v < 0 ? 'text-rosso' : 'text-soffuso');
  const segno = (v) => (v > 0 ? '+' : '') + v;

  return (
    <div className="mt-7">
      <Etichetta className="mb-2.5">Con quali cinque siamo andati meglio</Etichetta>

      <Pannello alto className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 text-center">
            <div className={cx('cifra text-[32px] font-bold leading-none', tono(migliore.saldo))}>
              {segno(migliore.saldo)}
            </div>
            <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-etichetta text-tenue">
              di scarto
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Maglie nomi={migliore.nomi} />
            <p className="mt-2 text-[12.5px] leading-relaxed text-soffuso">
              {migliore.f} punti fatti e {migliore.s} subiti, in {migliore.turni}{' '}
              {migliore.turni === 1 ? 'volta in campo insieme' : 'volte in campo insieme'}.
            </p>
          </div>
        </div>
      </Pannello>

      {altri.length > 0 && (
        <>
          <Etichetta className="mb-2 mt-5">Gli altri</Etichetta>
          <div className="space-y-2">
            {altri.map(q => (
              <Pannello key={q.chiave} className="px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={cx('cifra w-9 shrink-0 text-[15px] font-bold leading-none', tono(q.saldo))}>
                    {segno(q.saldo)}
                  </span>
                  <span className="min-w-0 flex-1"><Maglie nomi={q.nomi} /></span>
                  <span className="cifra shrink-0 text-[11.5px] text-tenue">{q.f}–{q.s}</span>
                </div>
                <BarraSaldo saldo={q.saldo} max={max} />
              </Pannello>
            ))}
          </div>
        </>
      )}

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
        Lo scarto è la differenza fra i punti fatti e quelli subiti dalla squadra mentre
        quei cinque erano in campo: <b className="text-soffuso">+12</b> vuol dire dodici punti
        guadagnati sugli avversari. I quintetti che non hanno visto nemmeno un punto — quelli
        che nascono da due cambi di fila a un time out — non sono in elenco.
      </p>
    </div>
  );
}

function Numero({ valore, etichetta, tono }) {
  return (
    <div>
      <div className={cx('cifra text-[22px] font-bold leading-none',
        tono === 'rosso' ? 'text-rosso' : tono === 'verde' ? 'text-verde' : 'text-testo')}>
        {valore}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase leading-tight tracking-etichetta text-tenue">
        {etichetta}
      </div>
    </div>
  );
}

function fmtData(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x) ? '' : x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* Il nome di chi ha corretto, se lo conosciamo.
 *
 * `state.staff` esclude genitori e atleti, e un segnapunti di famiglia
 * abilitato al tabellino non ci sta dentro: in quel caso resta senza nome, che
 * e' meglio di un identificativo lungo trenta caratteri. La data e il
 * punteggio, che sono la parte che conta, ci sono comunque. */
function nomeDi(id) {
  if (!id) return '';
  if (state.currentUser && state.currentUser.id === id) return 'tu';
  const p = (state.staff || []).find(x => x.id === id);
  return p ? (p.display_name || '') : '';
}

function nomeCategoria() {
  const s = (state.sectors || []).find(x => x.id === state.activeSectorId);
  return s ? sectorFullName(s, state.sectors) : '';
}

export function Referto({ partita, onChiudi, onEliminata }) {
  const sport = currentSport();
  const [lavora, setLavora] = useState(null);
  const [daEliminare, setDaEliminare] = useState(false);
  const [daCorreggere, setDaCorreggere] = useState(false);
  const [correzioni, setCorrezioni] = useState([]);
  const avvisa = useAvviso();

  /* La cancellazione sta QUI e non nell'elenco, di proposito.
   *
   * Una partita sbagliata — un tabellino aperto per prova, un 8-0 rimasto da
   * una partita mai giocata — sporca il record, la media punti e le
   * statistiche di ogni giocatrice. Va tolta. Ma è anche l'unica cosa in
   * questa schermata che non si può rifare: il tabellino non si ricostruisce
   * a memoria.
   *
   * Per questo il pulsante è dove la partita si vede per intero. Si guarda il
   * risultato, si guardano i set, si guarda chi ha giocato, e solo allora si
   * decide. Una piccola icona in un elenco si tocca per sbaglio. */
  const puoiEliminare = !!onEliminata
    && canDeleteGame(state.currentUser, state.activeSectorId, state.staffSectors);

  /* CORREGGERE, CHE NON E' CANCELLARE.
   *
   * Un canestro battuto male non vale la perdita di tutta la partita, ed era
   * l'unica strada che c'era. Si riapre il tabellino nello scout e si corregge
   * con la stessa interfaccia con cui lo si e' segnato. */
  const puoiCorreggere = canFixGame(
    state.currentUser, state.activeSectorId, state.staffSectors, partita.date
  );

  useEffect(() => {
    let vivo = true;
    if (inCampione() || !partita.id) return undefined;
    fetchGameCorrections(partita.id)
      .then(r => { if (vivo) setCorrezioni(r || []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [partita.id]);

  const conf = sport.scout;
  // «set» nella pallavolo, «periodo» nel basket: la parola la dice lo sport.
  const nomePeriodo = (conf.period.label || 'periodo').toLowerCase();
  // Le due fasi esistono solo dove ogni punto chiude uno scambio: altrove
  // sarebbero due colonne di trattini.
  const conFasi = !!conf.scambi;

  const r = refertoPartita(partita, sport);
  const t = tabellaTabellino(r, sport);
  const nostri = (state.teamProfile || {}).name || 'Noi';
  const vinta = (partita.teamScore || 0) > (partita.oppScore || 0);

  async function scaricaPdf() {
    setLavora('pdf');
    try {
      await generaRefertoPdf({
        team: state.teamProfile, game: partita, sport, sectorName: nomeCategoria()
      });
      avvisa('Referto scaricato');
    } catch (e) {
      console.error(e);
      avvisa((e && e.message) || 'Il PDF non si è generato.', 'errore');
    } finally {
      setLavora(null);
    }
  }

  function scaricaCsv() {
    downloadCsv(
      `referto_${safeName(nostri)}_${safeName(partita.oppName)}.csv`,
      t.intestazioni, t.righe
    );
    avvisa('Tabellino esportato');
  }

  return (
    <Finestra
      larga
      titolo={nostri + ' – ' + (partita.oppName || 'Avversari')}
      sotto={[fmtData(partita.date), partita.friendly ? 'amichevole' : 'campionato'].filter(Boolean).join(' · ')}
      onChiudi={onChiudi}
      azioni={
        <>
          <div className="flex flex-wrap gap-2">
            <Pulsante variante="primario" className="flex-1" disabled={!!lavora} onClick={scaricaPdf}>
              {lavora === 'pdf' ? 'Preparo…' : 'Scarica il referto in PDF'}
            </Pulsante>
            <Pulsante className="shrink-0" onClick={scaricaCsv}>CSV</Pulsante>
          </div>
          {puoiCorreggere && (
            <button
              type="button"
              onClick={() => setDaCorreggere(true)}
              className="mt-3 w-full rounded-lg vetro orlo py-2 text-[12.5px] font-semibold text-soffuso transition-colors hover:text-testo"
            >
              Correggi il tabellino
            </button>
          )}
          {puoiEliminare && (
            // Lontano dagli altri due e senza colore: si trova quando la si
            // cerca, e non si incontra quando si voleva il PDF.
            <button
              type="button"
              onClick={() => setDaEliminare(true)}
              className="mt-3 w-full rounded-lg py-2 text-[12.5px] font-semibold text-rosso transition-colors hover:bg-rosso/10"
            >
              Elimina questa partita dallo storico
            </button>
          )}
        </>
      }
    >
      {/* Il risultato, grande: è quello che si cerca per primo. */}
      <div className="mb-5 flex items-baseline gap-3">
        <span className={cx('cifra text-[40px] font-bold leading-none', vinta ? 'text-verde' : 'text-testo')}>
          {partita.teamScore ?? 0}<span className="mx-1.5 text-tenue">–</span>{partita.oppScore ?? 0}
        </span>
        <span className="text-[13px] text-tenue">
          {r.chiusi} {(r.chiusi === 1 ? nomePeriodo : nomePeriodo + (nomePeriodo.endsWith('o') ? 'i' : ''))}
        </span>
      </div>

      {/* ------------------------------------------------------------ i set */}
      {r.set.length > 0 && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">
            {nomePeriodo === 'set' ? 'I set' : 'I ' + nomePeriodo + 'i'}
          </Etichetta>
          <Pannello className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-bordo/10">
                    <th className="etichetta px-4 py-3">{conf.period.short}</th>
                    <th className="etichetta px-4 py-3">Punteggio</th>
                    {conFasi && <th className="etichetta px-4 py-3 text-right">Cambio palla</th>}
                    {conFasi && <th className="etichetta px-4 py-3 text-right">Break</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.set.map(s => (
                    <tr key={s.n} className="border-b border-bordo/6 last:border-b-0">
                      <td className="px-4 py-2.5 text-[13px] text-tenue">{s.n}</td>
                      <td className={cx('cifra px-4 py-2.5 text-[14px] font-bold',
                        s.us > s.them ? 'text-verde' : 'text-soffuso')}>
                        {s.us}–{s.them}
                      </td>
                      {conFasi && (
                        <td className="cifra px-4 py-2.5 text-right text-[13px]">
                          {quota(s.so) == null ? <span className="text-tenue">—</span> : (
                            <>{quota(s.so)}%<span className="ml-1.5 text-[12px] text-tenue">{s.so.v}/{s.so.t}</span></>
                          )}
                        </td>
                      )}
                      {conFasi && (
                        <td className="cifra px-4 py-2.5 text-right text-[13px]">
                          {quota(s.bp) == null ? <span className="text-tenue">—</span> : (
                            <>{quota(s.bp)}%<span className="ml-1.5 text-[12px] text-tenue">{s.bp.v}/{s.bp.t}</span></>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Pannello>

          {(r.fasi.so.t > 0 || r.fasi.bp.t > 0) && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
              In tutta la partita: cambio palla <b className="text-soffuso">{quota(r.fasi.so) ?? '—'}%</b>{' '}
              ({r.fasi.so.v} su {r.fasi.so.t}), break <b className="text-soffuso">{quota(r.fasi.bp) ?? '—'}%</b>{' '}
              ({r.fasi.bp.v} su {r.fasi.bp.t}).
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- le rotazioni */}
      {r.rotazioni.length > 0 && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">Le rotazioni</Etichetta>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {r.rotazioni.map(x => (
              <Pannello key={x.n} className="px-3 py-2.5 text-center">
                <div className="text-[11px] font-bold uppercase tracking-etichetta text-tenue">R{x.n}</div>
                <div className={cx('cifra mt-1 text-[18px] font-bold leading-none',
                  x.saldo > 0 ? 'text-verde' : x.saldo < 0 ? 'text-rosso' : 'text-soffuso')}>
                  {x.saldo > 0 ? '+' : ''}{x.saldo}
                </div>
                <div className="cifra mt-1 text-[11.5px] text-tenue">{x.f}–{x.s}</div>
              </Pannello>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Punti fatti e subiti in ciascuna rotazione. È da qui che si decide da quale far
            partire il sestetto la prossima volta.
          </p>
        </div>
      )}

      {r.ciambelle && (
        <Fondamentali
          voci={r.ciambelle}
          perPeriodo={r.ciambellePeriodi}
          nomePeriodo={nomePeriodo}
          titolo={sport.key === 'basket' ? 'Come abbiamo tirato' : 'I fondamentali'}
        />
      )}
      {r.riepilogo && <Riepilogo voci={r.riepilogo} />}
      {r.andamento && <Andamento a={r.andamento} />}

      {r.tiri && <MappaTiri sport={sport} tiri={r.tiri} />}
      {r.traiettorie && sport.campoIntero && <Traiettorie sport={sport} linee={r.traiettorie} />}
      {sport.campoIntero && (r.traiettorieAtleti || []).length > 0 && (
        <TraiettoriePerAtleta sport={sport} righe={r.traiettorieAtleti} />
      )}

      {/* -------------------------------------------- come abbiamo attaccato */}
      {conf.possessi && r.attacco && (
        <div className="mb-6">
          <Etichetta className="mb-2.5">Come abbiamo attaccato</Etichetta>
          <Pannello className="px-4 py-3.5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Numero
                valore={r.attacco.ppp.toFixed(2).replace('.', ',')}
                etichetta="Punti per possesso"
              />
              <Numero valore={r.attacco.possessi} etichetta="Possessi giocati" />
              <Numero
                valore={r.attacco.perse == null ? '—' : r.attacco.perse + '%'}
                etichetta="Possessi persi"
                tono={r.attacco.perse != null && r.attacco.perse > 20 ? 'rosso' : null}
              />
              <Numero
                valore={r.attacco.liberi == null ? '—' : r.attacco.liberi + '%'}
                etichetta="Liberi per 100 tiri"
              />
            </div>
          </Pannello>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
            Un possesso finisce con un tiro, con una palla persa o in lunetta. È l’unità che
            rende confrontabili due partite giocate a ritmi diversi: sessantotto punti in
            cinquanta possessi sono un’altra cosa da sessantotto in settanta.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------ il tabellino */}
      <Etichetta className="mb-2.5">Il tabellino</Etichetta>
      {t.righe.length === 0 ? (
        <Vuoto>Questa partita non ha un tabellino: il risultato è stato scritto a mano.</Vuoto>
      ) : (
        <Pannello className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-bordo/10">
                  {t.intestazioni.map((h, i) => (
                    <th key={h + i} className={cx('etichetta px-3 py-3', i > 1 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.righe.map((riga, i) => (
                  <tr key={i} className="border-b border-bordo/6 last:border-b-0">
                    {riga.map((cella, j) => (
                      <td
                        key={j}
                        className={cx('px-3 py-2.5 text-[13px]',
                          j === 0 && 'text-tenue',
                          j === 1 && 'font-semibold',
                          j > 1 && 'cifra text-right text-soffuso')}
                      >
                        {cella}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* La riga della squadra: in fondo, con un tratto sopra, come su
                  qualunque tabellino di carta. E' da li' che si legge com'e'
                  andata la partita, senza sommare a mente dodici righe. */}
              {t.totale && (
                <tfoot>
                  <tr className="border-t border-bordo/20">
                    {t.totale.map((cella, j) => (
                      <td
                        key={j}
                        className={cx('px-3 py-2.5 text-[13px] font-bold',
                          j > 1 && 'cifra text-right')}
                      >
                        {j === 0 ? '' : cella}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Pannello>
      )}

      {/* Le sigle spiegate sono quelle che stanno in QUESTA tabella, non
          quelle della tabella di stagione: qui non c'e' nessuna colonna
          «PG», e spiegarla faceva cercare una colonna inesistente. */}
      {legendaColonne(sport, t.intestazioni) && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-tenue">
          {legendaColonne(sport, t.intestazioni)}
        </p>
      )}

      {/* IN FONDO, E DA SOLA.
          Stava in mezzo alle altre sezioni ed era la piu' difficile da
          leggere: cinque numeri di maglia in fila e un numero col segno
          davanti, senza niente che dicesse cosa fossero. Chi la incontrava a
          meta' referto doveva indovinare. Qui in fondo e' l'ultima cosa che
          si legge, ed e' quella che si guarda a mente fredda — non durante
          la partita, ma la sera dopo, decidendo chi far entrare la prossima
          volta in un finale punto a punto. */}
      {r.quintetti.length > 0 && <Quintetti quintetti={r.quintetti} />}

      {/* CHI HA MESSO LE MANI SU QUESTI NUMERI.
          Un tabellino che cambia dopo la partita, senza che si sappia chi
          l'ha cambiato, e' un tabellino di cui non ci si fida piu'. Non e'
          sospetto: e' la ragione per cui esiste la firma in fondo a un
          referto di carta. */}
      {correzioni.length > 0 && (
        <div className="mt-7">
          <Etichetta className="mb-2">Correzioni</Etichetta>
          <div className="space-y-1">
            {correzioni.map(c => (
              <p key={c.id} className="text-[12.5px] leading-relaxed text-tenue">
                {c.azione === 'riaperta' ? 'Riaperta' : 'Richiusa'} il{' '}
                {new Date(c.quando).toLocaleString('it-IT', {
                  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                })}
                {c.punteggio ? <> — punteggio <span className="cifra text-soffuso">{c.punteggio}</span></> : null}
                {nomeDi(c.chi) ? ' · ' + nomeDi(c.chi) : ''}
              </p>
            ))}
          </div>
        </div>
      )}

      {daCorreggere && (
        <Conferma
          titolo="Correggere il tabellino?"
          testo={
            'La partita torna «in corso» e si apre nello Scout: correggi con la stessa '
            + 'interfaccia con cui l’hai segnata, poi la richiudi. Finché è aperta sparisce '
            + 'dallo storico e dalle statistiche, e resta scritto chi l’ha riaperta e quando.'
          }
          etichetta="Riapri nello Scout"
          pericolo={false}
          onChiudi={() => setDaCorreggere(false)}
          onConferma={async () => {
            if (inCampione()) {
              throw new Error('Nell’anteprima con dati di esempio non si corregge niente.');
            }
            await reopenGameForFix(partita.id);
            // La sezione aperta sta nell'indirizzo: cambiarlo porta allo Scout
            // senza dover far passare una richiamata da tre schermate.
            window.location.hash = '#/partita';
            onChiudi();
          }}
        />
      )}

      {daEliminare && (
        <Conferma
          titolo="Eliminare questa partita?"
          testo={
            `${nostri} – ${partita.oppName || 'Avversari'} ${partita.teamScore ?? 0}–${partita.oppScore ?? 0}`
            + ' sparisce dallo storico, e con lei il tabellino di tutti i giocatori.'
            + ' Record, media punti e statistiche si ricalcolano senza. Non si recupera.'
          }
          etichetta="Elimina"
          onChiudi={() => setDaEliminare(false)}
          onConferma={async () => {
            if (inCampione()) {
              throw new Error('Nell’anteprima con dati di esempio non si cancella niente.');
            }
            await deleteGame(partita.id);
            onEliminata(partita);
          }}
        />
      )}
    </Finestra>
  );
}
