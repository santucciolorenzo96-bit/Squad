import React from 'react';

/* Le primitive del sistema "vetro".
 *
 * La regola che tiene in piedi tutto: il vetro è una gerarchia, non una
 * texture. Se ogni superficie è traslucida e sfocata, niente sta sopra niente
 * e la profondità scompare — che è il modo in cui questa estetica viene fatta
 * male. Qui ci sono tre livelli e basta:
 *
 *   piano   il fondo della scena, con i suoi aloni. Non è un componente.
 *   vetro   il pannello ordinario: quasi tutto sta qui.
 *   alto    quello che deve staccarsi: la testata, la scheda di apertura,
 *           i fogli sopra il contenuto. Si usa poco per definizione.
 */

export function cx(...parti) {
  return parti.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- Pannello */
export function Pannello({ alto = false, className, children, ...resto }) {
  return (
    <div
      className={cx(
        'rounded-lg orlo',
        alto ? 'vetro-alto shadow-lg' : 'vetro shadow',
        className
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Etichetta */
export function Etichetta({ children, className }) {
  return <div className={cx('etichetta', className)}>{children}</div>;
}

/* ------------------------------------------------------------------- Stato */
// Pastiglie a bassa saturazione: il colore pieno lo tengono le icone e il
// pulsante primario. Se anche le etichette di stato urlano, non si capisce più
// dove guardare per primo.
const TONI = {
  neutro: 'bg-pannello/12 text-soffuso',
  buono: 'bg-verde/14 text-verde',
  attesa: 'bg-ambra/16 text-ambra',
  fermo: 'bg-rosso/16 text-rosso'
};

export function Stato({ tono = 'neutro', children, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1',
        'text-[10.5px] font-bold uppercase tracking-etichetta',
        TONI[tono] || TONI.neutro,
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Pulsante */
const VARIANTI = {
  // Il primario è l'unico oggetto con una sfumatura piena e un alone: è così
  // che si vede da lontano qual è l'azione della schermata.
  primario:
    'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu hover:brightness-110 active:brightness-95',
  vetro:
    'vetro orlo text-testo hover:bg-pannello/12 active:brightness-95',
  nudo:
    'text-soffuso hover:text-testo hover:bg-pannello/10'
};

export function Pulsante({ variante = 'vetro', className, children, ...resto }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
        'text-[13px] font-medium transition-all duration-150',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANTI[variante] || VARIANTI.vetro,
        className
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Dato */
// Un numero grande, la sua etichetta sopra piccola, e una nota sotto. La
// gerarchia la fa la dimensione; il colore entra solo quando il numero è un
// problema, altrimenti quattro riquadri colorati si annullano a vicenda.
export function Dato({ etichetta, valore, sotto, tono, icona }) {
  const colore = tono === 'fermo' ? 'text-rosso' : tono === 'attesa' ? 'text-ambra' : 'text-testo';
  return (
    <Pannello className="pad-pannello-stretto">
      <div className="flex items-start justify-between gap-2">
        <Etichetta>{etichetta}</Etichetta>
        {icona}
      </div>
      {/* 12 fra etichetta e numero, 6 fra numero e nota: la nota appartiene al
          numero, l’etichetta lo introduce. Entrambi restano ben sotto il
          padding del pannello, che è quello che tiene insieme il gruppo. */}
      <div className={cx('mt-3 text-[30px] font-bold leading-none tracking-tight', colore)}>
        {valore}
      </div>
      {sotto && <div className="mt-1.5 text-[11.5px] leading-snug text-tenue">{sotto}</div>}
    </Pannello>
  );
}

/* ------------------------------------------------------------------- Vuoto */
export function Vuoto({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-bordo/15 px-6 py-10 text-center">
      <p className="mx-auto max-w-[46ch] text-[13.5px] leading-relaxed text-tenue">{children}</p>
    </div>
  );
}

/* --------------------------------------------------------------- Scheletro */
export function Scheletro({ righe = 3 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: righe }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg orlo bg-pannello/6" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */
// Senza foto: iniziali su una sfumatura scelta dal nome, così la stessa persona
// ha sempre lo stesso colore e la si riconosce prima di leggere.
const SFUMATURE = [
  'from-[#5B9BFF] to-[#1E5BE0]',
  'from-[#FF7FB0] to-[#E01E6E]',
  'from-[#5FE3A6] to-[#12A868]',
  'from-[#FF9A7A] to-[#E24A22]',
  'from-[#B39BFF] to-[#6D3FE0]',
  'from-[#63DCF0] to-[#128FA8]'
];

function impronta(s) {
  let n = 0;
  for (let i = 0; i < (s || '').length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

export function Avatar({ nome, url, dim = 34 }) {
  const iniziali = (nome || '?')
    .split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="shrink-0 rounded-full orlo object-cover"
        style={{ width: dim, height: dim }}
      />
    );
  }
  const g = SFUMATURE[impronta(nome) % SFUMATURE.length];
  return (
    <div
      className={cx(
        'shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center',
        'font-semibold text-white shadow-sm', g
      )}
      style={{ width: dim, height: dim, fontSize: Math.round(dim * 0.36) }}
    >
      {iniziali}
    </div>
  );
}

/* ------------------------------------------------------------------ Titolo */
export function Titolo({ sopra, children, azione, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {sopra && <Etichetta className="mb-2">{sopra}</Etichetta>}
        <h1 className="text-[clamp(23px,4.6vw,32px)] font-bold leading-none tracking-tight">
          {children}
        </h1>
      </div>
      {azione}
    </div>
  );
}
