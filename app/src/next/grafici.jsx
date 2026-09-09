import React from 'react';
import { cx } from './ui.jsx';

/* Grafici.
 *
 * Scritti a mano in SVG, senza librerie: quelle che si usano di solito pesano
 * più di tutta l'app messa insieme, e qui servono tre forme in tutto. Il
 * progetto non ha mai avuto dipendenze superflue e non è il momento di
 * cominciare.
 *
 * Una regola, che è quella che separa un grafico da una decorazione: OGNI
 * GRANDEZZA VISIVA DEVE ESSERE PROPORZIONALE AL NUMERO CHE RAPPRESENTA. Niente
 * barre con un minimo "così si vede", niente scale che partono da un valore
 * arbitrario. Se una barra è la metà di un'altra, quel numero è la metà.
 */

export function euro(n, { segno = false } = {}) {
  const v = Number(n) || 0;
  const s = v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  return segno && v > 0 ? '+' + s : s;
}

export function euroPreciso(n) {
  return (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

/* ------------------------------------------------------------ barra piena */
// Una barra orizzontale che dice "quanto di quanto". Serve per il pagato
// rispetto al previsto: un numero da solo non dice a che punto si è.
export function Avanzamento({ fatto, totale, tono = 'blu', className }) {
  const t = Number(totale) || 0;
  const f = Math.max(0, Math.min(Number(fatto) || 0, t));
  const pct = t > 0 ? (f / t) * 100 : 0;
  const colore = { blu: 'bg-blu', verde: 'bg-verde', ambra: 'bg-ambra', rosso: 'bg-rosso' }[tono] || 'bg-blu';
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-pannello/16', className)}>
      <div className={cx('h-full rounded-full transition-all', colore)} style={{ width: pct + '%' }} />
    </div>
  );
}

/* --------------------------------------------------------- barra impilata */
// Più quantità dentro la stessa lunghezza. Le fette sotto una certa larghezza
// spariscono invece di essere allargate al minimo leggibile: una fetta gonfiata
// mente sulla proporzione, ed è esattamente ciò per cui la barra esiste.
export function Impilata({ fette, className, altezza = 10 }) {
  const totale = fette.reduce((s, f) => s + (Number(f.valore) || 0), 0);
  if (totale <= 0) {
    return <div className={cx('w-full rounded-full bg-pannello/12', className)} style={{ height: altezza }} />;
  }
  return (
    <div className={cx('flex w-full overflow-hidden rounded-full', className)} style={{ height: altezza }}>
      {fette.map((f, i) => {
        const pct = ((Number(f.valore) || 0) / totale) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={i}
            title={`${f.nome}: ${euro(f.valore)}`}
            className={f.classe}
            style={{ width: pct + '%' }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------ colonne affrontate */
// Entrate sopra la linea, uscite sotto. È il modo in cui si legge un
// andamento di cassa: si vede subito in quali mesi si è speso più di quanto
// si è incassato, che è la domanda vera.
//
// L'asse è condiviso fra sopra e sotto: se le entrate di gennaio sono il
// doppio delle uscite di marzo, la colonna è il doppio. Due scale separate
// renderebbero il grafico più "pieno" e completamente bugiardo.
export function ColonneAffrontate({ mesi, className }) {
  const max = Math.max(1, ...mesi.map(m => Math.max(m.entrate || 0, m.uscite || 0)));
  const H = 74;      // altezza di metà grafico
  const larghezza = 100 / Math.max(mesi.length, 1);

  return (
    <div className={className}>
      <div className="flex items-stretch" style={{ height: H * 2 + 18 }}>
        {mesi.map((m, i) => {
          const hIn = ((m.entrate || 0) / max) * H;
          const hOut = ((m.uscite || 0) / max) * H;
          return (
            <div key={i} className="flex flex-col items-center" style={{ width: larghezza + '%' }}>
              <div className="flex w-full flex-1 items-end justify-center" style={{ height: H }}>
                <div
                  title={`Entrate ${m.etichetta}: ${euro(m.entrate)}`}
                  className="w-[58%] rounded-t-sm bg-gradient-to-t from-verde/45 to-verde"
                  style={{ height: Math.max(hIn, m.entrate > 0 ? 2 : 0) }}
                />
              </div>
              <div className="h-px w-full bg-bordo/20" />
              <div className="flex w-full flex-1 items-start justify-center" style={{ height: H }}>
                <div
                  title={`Uscite ${m.etichetta}: ${euro(m.uscite)}`}
                  className="w-[58%] rounded-b-sm bg-gradient-to-b from-rosso/70 to-rosso/35"
                  style={{ height: Math.max(hOut, m.uscite > 0 ? 2 : 0) }}
                />
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-etichetta text-tenue">
                {m.etichetta}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- anello */
// Una torta con il buco: la usiamo per la composizione delle uscite. Con più
// di sei voci diventa illeggibile, quindi le altre si sommano in "Altro" —
// un anello con venti fette non è un grafico, è un mosaico.
export function Anello({ fette, dim = 132, spessore = 16, centro }) {
  const totale = fette.reduce((s, f) => s + (Number(f.valore) || 0), 0);
  const r = (dim - spessore) / 2;
  const c = dim / 2;
  const circonferenza = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={spessore}
          className="stroke-pannello/12" />
        {totale > 0 && fette.map((f, i) => {
          const quota = (Number(f.valore) || 0) / totale;
          const lung = quota * circonferenza;
          const el = (
            <circle
              key={i}
              cx={c} cy={c} r={r}
              fill="none"
              strokeWidth={spessore}
              stroke={f.colore}
              strokeDasharray={`${lung} ${circonferenza - lung}`}
              strokeDashoffset={-offset}
            >
              <title>{f.nome}: {euro(f.valore)}</title>
            </circle>
          );
          offset += lung;
          return el;
        })}
      </svg>
      {centro && (
        <div className="absolute inset-0 grid place-items-center text-center">
          {centro}
        </div>
      )}
    </div>
  );
}

// I colori delle fette: gli stessi sei delle icone, così tutta l'app usa una
// tavolozza sola invece di inventarne una per i grafici.
export const COLORI_FETTA = [
  'rgb(var(--blu))', 'rgb(var(--viola))', 'rgb(var(--ciano))',
  'rgb(var(--ambra))', 'rgb(var(--rosa))', 'rgb(var(--verde))'
];

// Riduce un elenco a `max` voci più "Altro": con troppe fette l'anello smette
// di comunicare.
export function raggruppa(voci, max = 5) {
  const ordinate = voci.slice().sort((a, b) => b.valore - a.valore);
  if (ordinate.length <= max + 1) return ordinate;
  const teste = ordinate.slice(0, max);
  const coda = ordinate.slice(max).reduce((s, v) => s + v.valore, 0);
  return coda > 0 ? [...teste, { nome: 'Altro', valore: coda }] : teste;
}
