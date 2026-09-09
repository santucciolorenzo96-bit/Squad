import React from 'react';

/* Le primitive del sistema "carta e inchiostro".
 *
 * Sono poche di proposito. Un sistema di design non è una libreria di
 * componenti: è un insieme di decisioni già prese. Qui le decisioni sono che
 * gli angoli sono quasi vivi, le ombre sono dure e spostate, il colore dice
 * solo lo stato, e i numeri sono sempre monospaziati.
 */

export function cx(...parti) {
  return parti.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Foglio */
// `rilievo` alza il blocco dal piano: si usa per quello che conta in una
// schermata, mai per tutto. Se tutto è in rilievo niente lo è.
export function Foglio({ rilievo = false, className, children, ...resto }) {
  return (
    <div
      className={cx(
        'bg-carta border riga',
        rilievo ? 'border-2 shadow' : 'shadow-sm',
        className
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Etichetta */
export function Etichetta({ children, className }) {
  return <div className={cx('etichetta', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Titolo */
// Il titolo di sezione è tipografico e non decorato: pesa perché è grande e
// stretto, non perché ha un colore o un'icona accanto.
export function Titolo({ children, sopra, azione, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-3 mb-3', className)}>
      <div className="min-w-0">
        {sopra && <Etichetta className="mb-1">{sopra}</Etichetta>}
        <h2 className="font-serif text-[26px] leading-none tracking-[-0.01em]">{children}</h2>
      </div>
      {azione}
    </div>
  );
}

/* ------------------------------------------------------------------- Stato */
// Quattro toni, nessuno in più. Il colore qui non abbellisce: dice se una
// persona può scendere in campo o no, quindi non va speso per altro.
const TONI = {
  neutro: 'border-matita/25 text-grafite',
  buono: 'border-verde/45 text-verde',
  attesa: 'border-ambra/50 text-ambra',
  fermo: 'border-timbro/50 text-timbro'
};

export function Stato({ tono = 'neutro', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap border px-2 py-[3px]',
        'text-[10px] font-bold uppercase tracking-etichetta',
        TONI[tono] || TONI.neutro
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Pulsante */
const VARIANTI = {
  // Il pieno è inchiostro su carta, non un colore d'accento: il rosso resta il
  // timbro, e un timbro perde valore se lo si mette su ogni pulsante.
  pieno: 'bg-inchiostro text-carta border-inchiostro hover:shadow active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
  vuoto: 'bg-carta text-inchiostro riga border hover:shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
  nudo: 'bg-transparent text-grafite border-transparent hover:text-inchiostro'
};

export function Pulsante({ variante = 'vuoto', className, children, ...resto }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 border px-3 py-2',
        'text-[12.5px] font-semibold transition-shadow',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTI[variante] || VARIANTI.vuoto,
        className
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------------- Dato */
// Un numero e cosa significa. Il numero è grande e monospaziato, la didascalia
// è piccola e spaziata: la gerarchia la fa il contrasto di dimensione, non un
// riquadro colorato attorno.
export function Dato({ etichetta, valore, sotto, tono }) {
  const colore = tono === 'fermo' ? 'text-timbro' : tono === 'attesa' ? 'text-ambra' : 'text-inchiostro';
  return (
    <Foglio className="px-4 py-3">
      <Etichetta>{etichetta}</Etichetta>
      <div className={cx('cifra mt-2 text-[30px] font-bold leading-none', colore)}>{valore}</div>
      {sotto && <div className="mt-1.5 text-[11.5px] leading-tight text-grafite">{sotto}</div>}
    </Foglio>
  );
}

/* ------------------------------------------------------------------- Vuoto */
// Uno stato vuoto scritto in serif e in italiano vero. È il punto in cui
// un'interfaccia rivela chi l'ha fatta: "Nessun dato disponibile" non l'ha
// scritto nessuno.
export function Vuoto({ children }) {
  return (
    <div className="border border-dashed riga px-5 py-8 text-center">
      <p className="font-serif italic text-[15px] text-grafite">{children}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Scheletro */
export function Scheletro({ righe = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: righe }).map((_, i) => (
        <div key={i} className="h-14 border riga bg-carta2 animate-pulse" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */
// Iniziali su fondo carta con bordo pieno. Tondo, perché è l'unica forma che
// ha senso per un volto — è l'eccezione dichiarata agli angoli vivi.
export function Avatar({ nome, url, dim = 34 }) {
  const iniziali = (nome || '?')
    .split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  return url ? (
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-full border riga object-cover"
      style={{ width: dim, height: dim }}
    />
  ) : (
    <div
      className="shrink-0 rounded-full border-2 riga flex items-center justify-center bg-carta2 font-mono font-bold text-inchiostro"
      style={{ width: dim, height: dim, fontSize: Math.round(dim * 0.34) }}
    >
      {iniziali}
    </div>
  );
}
