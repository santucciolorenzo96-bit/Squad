import React, { useId } from 'react';

/* Icone Gradient Glow.
 *
 * Una piastrella morbida con dentro una sfumatura viva, un alone dello stesso
 * colore che la stacca dal fondo, e il glifo bianco sopra. E' il pacchetto che
 * la societa' ha scelto, e qui e' ricostruito in SVG invece che importato come
 * immagine: cosi' pesa zero, resta nitido a ogni misura, segue il tema e i
 * colori si cambiano in una riga.
 *
 * Costruzione, dal fondo alla superficie:
 *
 *   1. l'ALONE: la stessa sagoma, sfocata, nel colore dell'icona. E' quello
 *      che rende «glow» un'icona piatta. Tenuto basso — sfocatura corta e
 *      meno di meta' opacita' — perche' un alone largo su cinque icone
 *      affiancate diventa una nebbia colorata e si smette di distinguerle;
 *   2. il CORPO, in sfumatura obliqua: colore chiaro in alto a sinistra,
 *      colore caldo in basso a destra. La luce viene sempre da li', per tutte;
 *   3. la CUPOLA: un bagliore bianco che si spegne verso il basso. E' la
 *      lucidita' della plastica, ed e' quello che distingue queste icone da
 *      una semplice campitura sfumata;
 *   4. il BORDO: bianco acceso sul filo alto, quasi spento in basso — il
 *      punto dove la superficie incontra la luce;
 *   5. il GLIFO, bianco, sopra tutto.
 *
 * Il glifo occupa poco piu' di meta' della piastrella: e' la proporzione del
 * pacchetto, e a venti pixel e' anche quella che resta leggibile.
 */

// Le coppie del pacchetto per le cinque macro, e coppie della stessa famiglia
// per tutto il resto. Prima e' il colore in alto a sinistra, poi quello in
// basso a destra.
const TONI = {
  blu: ['#3B82F6', '#A855F7'],        // Home
  verde: ['#10B981', '#06B6D4'],      // Allenamenti
  rosa: ['#8B5CF6', '#EC4899'],       // Squadra
  corallo: ['#F59E0B', '#EF4444'],    // Partite
  indaco: ['#6366F1', '#06B6D4'],     // Societa'
  viola: ['#8B5CF6', '#6366F1'],
  ciano: ['#06B6D4', '#3B82F6'],
  ambra: ['#F59E0B', '#EC4899'],
  fucsia: ['#EC4899', '#8B5CF6'],
  smeraldo: ['#34D399', '#059669'],
  rosso: ['#EF4444', '#EC4899']
};

// `glifo` disegna dentro un riquadro 0 0 24 24, poi rimpicciolito e centrato.
export function Icona({ tono = 'blu', dim = 26, glifo, className }) {
  const [chiaro, scuro] = TONI[tono] || TONI.blu;
  // Stabile per istanza: non cambia a ogni ridisegno, quindi il DOM non viene
  // toccato per niente quando la schermata si aggiorna.
  const n = useId().replace(/:/g, '');
  const gCorpo = 'ic' + n + 'c';
  const gCupola = 'ic' + n + 'd';
  const gBordo = 'ic' + n + 'b';
  const gAlone = 'ic' + n + 'a';
  const rit = 'ic' + n + 'r';

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gCorpo} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor={chiaro} />
          <stop offset="1" stopColor={scuro} />
        </linearGradient>

        {/* La cupola parte dall'alto e si spegne a meta': piu' in basso
            resterebbe una velatura lattiginosa sul colore pieno. */}
        <radialGradient id={gCupola} cx="0.5" cy="-0.05" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={gBordo} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.22" />
        </linearGradient>

        {/* L'alone e' una sfumatura, non una sfocatura.

            Una feGaussianBlur darebbe lo stesso risultato, ma nella barra in
            basso le icone cambiano misura fotogramma per fotogramma mentre si
            scorre, e un filtro va ricalcolato a ogni misura: e' il modo piu'
            sicuro di rendere legnoso l'unico posto dell'app che deve sembrare
            fluido. Una sfumatura radiale non costa niente e a questa misura
            non si distingue. */}
        <radialGradient id={gAlone} cx="0.5" cy="0.56" r="0.5">
          <stop offset="0.42" stopColor={scuro} stopOpacity="0.5" />
          <stop offset="0.7" stopColor={scuro} stopOpacity="0.2" />
          <stop offset="1" stopColor={scuro} stopOpacity="0" />
        </radialGradient>

        <clipPath id={rit}>
          <rect x="5" y="4.6" width="30" height="30" rx="10.2" />
        </clipPath>
      </defs>

      {/* 1. l'alone */}
      <rect x="0" y="0" width="40" height="40" fill={`url(#${gAlone})`} />

      {/* 2. il corpo */}
      <rect x="5" y="4.6" width="30" height="30" rx="10.2" fill={`url(#${gCorpo})`} />

      {/* 3. la cupola, ritagliata dentro il corpo */}
      <g clipPath={`url(#${rit})`}>
        <rect x="5" y="4.6" width="30" height="30" fill={`url(#${gCupola})`} />
      </g>

      {/* 4. il bordo */}
      <rect
        x="5.5" y="5.1" width="29" height="29" rx="9.7"
        fill="none" stroke={`url(#${gBordo})`} strokeWidth="1"
      />

      {/* 5. il glifo */}
      <g transform="translate(10.9 10.55) scale(0.76)" fill="#fff" fillOpacity="0.97">
        {glifo}
      </g>
    </svg>
  );
}

const G = {
  // Casa
  home: <path d="M12 4.4 4.2 10.6v8.2c0 .7.6 1.2 1.2 1.2h3.4v-5.1h6.4V20h3.4c.7 0 1.2-.5 1.2-1.2v-8.2L12 4.4Z" />,

  // Squadra: tre figure, una davanti e due ai lati. Il gruppo si legge dal
  // profilo d'insieme prima che dalle singole teste: per questo le due dietro
  // sono piu' piccole e leggermente in ombra, e quella centrale piu' alta.
  rosa: (
    <>
      <circle cx="4.6" cy="8.9" r="2.9" fillOpacity="0.72" />
      <path d="M.6 18.1c0-2.7 2-4.4 4.6-4.4.7 0 1.35.12 1.94.35-1.5 1.15-2.4 2.8-2.5 4.85H1.4a.8.8 0 0 1-.8-.8Z" fillOpacity="0.72" />
      <circle cx="19.4" cy="8.9" r="2.9" fillOpacity="0.72" />
      <path d="M23.4 18.1c0-2.7-2-4.4-4.6-4.4-.7 0-1.35.12-1.94.35 1.5 1.15 2.4 2.8 2.5 4.85h3.24a.8.8 0 0 0 .8-.8Z" fillOpacity="0.72" />
      <circle cx="12" cy="7.1" r="4" />
      <path d="M4.6 20.1c0-3.9 3.3-6.1 7.4-6.1s7.4 2.2 7.4 6.1c0 .72-.55 1.3-1.25 1.3H5.85c-.7 0-1.25-.58-1.25-1.3Z" />
    </>
  ),

  // Anagrafica: la scheda con la riga del nome
  anagrafica: (
    <>
      <rect x="3.6" y="3.4" width="16.8" height="17.2" rx="3" fillOpacity="0.5" />
      <circle cx="9.4" cy="9.6" r="2.5" />
      <path d="M5.6 16.9c0-2 1.7-3.2 3.8-3.2s3.8 1.2 3.8 3.2c0 .4-.3.6-.7.6H6.3c-.4 0-.7-.2-.7-.6Z" />
      <rect x="14.4" y="8.4" width="4.2" height="1.7" rx=".85" />
      <rect x="14.4" y="12" width="4.2" height="1.7" rx=".85" fillOpacity="0.7" />
    </>
  ),

  // Partita: la palla
  partita: (
    <>
      <circle cx="12" cy="12" r="8.4" fillOpacity="0.55" />
      <path d="M12 3.6v16.8M3.6 12h16.8" stroke="#fff" strokeOpacity=".95" strokeWidth="1.5" />
      <path d="M6.1 5.4c2.4 1.9 3.6 4 3.6 6.6s-1.2 4.7-3.6 6.6M17.9 5.4c-2.4 1.9-3.6 4-3.6 6.6s1.2 4.7 3.6 6.6" stroke="#fff" strokeOpacity=".8" strokeWidth="1.3" fill="none" />
    </>
  ),

  // Allenamenti: il fischietto/cronometro semplificato in clessidra di attività
  allenamenti: (
    <>
      <rect x="2.6" y="9.6" width="3.4" height="4.8" rx="1.3" />
      <rect x="18" y="9.6" width="3.4" height="4.8" rx="1.3" />
      <rect x="6.4" y="7.6" width="3.2" height="8.8" rx="1.4" fillOpacity="0.82" />
      <rect x="14.4" y="7.6" width="3.2" height="8.8" rx="1.4" fillOpacity="0.82" />
      <rect x="9" y="11" width="6" height="2" rx="1" />
    </>
  ),

  // Presenze: la spunta sull'elenco
  presenze: (
    <>
      <rect x="3.4" y="3.6" width="12.4" height="16.8" rx="3" fillOpacity="0.5" />
      <rect x="6.1" y="7.4" width="7" height="1.7" rx=".85" />
      <rect x="6.1" y="11" width="7" height="1.7" rx=".85" fillOpacity="0.75" />
      <rect x="6.1" y="14.6" width="4.4" height="1.7" rx=".85" fillOpacity="0.55" />
      <circle cx="16.9" cy="15.6" r="4.8" />
      <path d="m14.8 15.7 1.5 1.5 2.9-3" stroke="#1b1f2e" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),

  // Comunicazioni: le due nuvolette del riferimento
  comunicazioni: (
    <>
      <path d="M4.2 6.6c0-1.5 1.2-2.6 2.7-2.6h9.2c1.5 0 2.7 1.1 2.7 2.6v5.2c0 1.5-1.2 2.7-2.7 2.7h-5l-4 3v-3h-.2c-1.5 0-2.7-1.2-2.7-2.7V6.6Z" />
      <circle cx="8.6" cy="9.2" r="1.25" fill="#1b1f2e" fillOpacity=".55" />
      <circle cx="11.9" cy="9.2" r="1.25" fill="#1b1f2e" fillOpacity=".55" />
      <circle cx="15.2" cy="9.2" r="1.25" fill="#1b1f2e" fillOpacity=".55" />
    </>
  ),

  // Classifica: il podio
  classifica: (
    <>
      <rect x="9" y="5.6" width="6" height="14.8" rx="1.6" />
      <rect x="2.8" y="10.6" width="5.6" height="9.8" rx="1.6" fillOpacity="0.72" />
      <rect x="15.6" y="13.4" width="5.6" height="7" rx="1.6" fillOpacity="0.58" />
    </>
  ),

  // Statistiche: le barre in salita
  statistiche: (
    <>
      <rect x="3.4" y="13.6" width="3.8" height="6.8" rx="1.5" fillOpacity="0.6" />
      <rect x="9.2" y="9.2" width="3.8" height="11.2" rx="1.5" fillOpacity="0.8" />
      <rect x="15" y="4.4" width="3.8" height="16" rx="1.5" />
    </>
  ),

  // Calendario: come nel riferimento, con gli anelli sopra
  calendario: (
    <>
      <rect x="3.2" y="5.2" width="17.6" height="15.4" rx="3.2" fillOpacity="0.55" />
      <rect x="3.2" y="5.2" width="17.6" height="4.6" rx="2.2" />
      <rect x="7" y="2.6" width="1.9" height="4.6" rx=".95" />
      <rect x="15.1" y="2.6" width="1.9" height="4.6" rx=".95" />
      <circle cx="8" cy="13.4" r="1.25" />
      <circle cx="12" cy="13.4" r="1.25" />
      <circle cx="16" cy="13.4" r="1.25" />
      <circle cx="8" cy="17.2" r="1.25" />
      <circle cx="12" cy="17.2" r="1.25" />
    </>
  ),

  // Situazione: il segnale
  situazione: (
    <>
      <path d="M12 3.2c.7 0 1.3.4 1.6 1l7.1 13.2c.6 1.1-.2 2.4-1.5 2.4H4.8c-1.3 0-2.1-1.3-1.5-2.4L10.4 4.2c.3-.6.9-1 1.6-1Z" />
      <rect x="11" y="8.6" width="2" height="5.6" rx="1" fill="#1b1f2e" fillOpacity=".6" />
      <circle cx="12" cy="16.6" r="1.2" fill="#1b1f2e" fillOpacity=".6" />
    </>
  ),

  // Documenti: i fogli sovrapposti
  documenti: (
    <>
      <rect x="6.6" y="2.8" width="14" height="16.6" rx="2.8" fillOpacity="0.5" />
      <rect x="3.4" y="5.4" width="14" height="16.6" rx="2.8" />
      <rect x="6.4" y="9.6" width="8" height="1.7" rx=".85" fill="#1b1f2e" fillOpacity=".45" />
      <rect x="6.4" y="13.2" width="8" height="1.7" rx=".85" fill="#1b1f2e" fillOpacity=".32" />
    </>
  ),

  // Utenti
  utenti: (
    <>
      <circle cx="9.6" cy="8.4" r="3.4" />
      <path d="M3 19.4c0-3.3 2.9-5.4 6.6-5.4s6.6 2.1 6.6 5.4c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1Z" />
      <circle cx="17.6" cy="9.6" r="2.5" fillOpacity="0.62" />
      <path d="M16.4 14.2c2.9 0 5 1.6 5 4.3 0 .5-.4.9-.9.9h-2.2c0-2.1-.7-3.9-1.9-5.2Z" fillOpacity="0.62" />
    </>
  ),

  // Societa': l'edificio con le colonne. Non e' la squadra — quella sono le
  // persone — e' l'istituzione: la sede, i conti, le carte. Due cose diverse
  // meritano due simboli diversi, altrimenti nel menu si scelgono a caso.
  squadra: (
    <>
      <path d="M11.5 2.55a1.1 1.1 0 0 1 1 0l9.3 4.6c.42.2.66.66.58 1.12-.08.46-.48.79-.95.79H2.57a.96.96 0 0 1-.95-.79c-.08-.46.16-.91.58-1.12l9.3-4.6Z" />
      <rect x="4.1" y="10.9" width="3.3" height="7.6" rx="1.3" fillOpacity="0.92" />
      <rect x="10.35" y="10.9" width="3.3" height="7.6" rx="1.3" fillOpacity="0.92" />
      <rect x="16.6" y="10.9" width="3.3" height="7.6" rx="1.3" fillOpacity="0.92" />
      <rect x="2.2" y="19.7" width="19.6" height="2.7" rx="1.35" />
    </>
  ),

  // Finanza: la moneta
  finanza: (
    <>
      <circle cx="12" cy="12" r="8.6" fillOpacity="0.55" />
      <circle cx="12" cy="12" r="6.2" />
      <path d="M12 7.8v8.4M9.8 10.1c0-1 1-1.7 2.2-1.7s2.2.7 2.2 1.6c0 2.4-4.4 1.2-4.4 3.6 0 1 1 1.7 2.2 1.7s2.2-.7 2.2-1.7" stroke="#1b1f2e" strokeOpacity=".62" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),

  // Profilo
  profilo: (
    <>
      <circle cx="12" cy="8.4" r="4" />
      <path d="M3.6 20c0-3.9 3.6-6.2 8.4-6.2s8.4 2.3 8.4 6.2c0 .5-.4.9-.9.9H4.5c-.5 0-.9-.4-.9-.9Z" />
    </>
  )
};

/* Colore e glifo per sezione. Una tabella sola: se il colore di una sezione
   cambia, cambia in un posto. */
/* Colore e glifo per sezione. Una tabella sola: se il colore di una sezione
   cambia, cambia in un posto.

   Le cinque macro portano le coppie del pacchetto, esattamente quelle: sono
   quelle che si imparano, perche' stanno nella barra in basso e si vedono
   tutto il giorno. Le altre sezioni prendono coppie della stessa famiglia,
   scelte in modo che dentro una macro le sorelle non si confondano. */
export const SEZIONI = {
  home: { tono: 'blu', glifo: G.home },                 // macro Home
  rosa: { tono: 'rosa', glifo: G.rosa },                // macro Squadra
  anagrafica: { tono: 'viola', glifo: G.anagrafica },
  comunicazioni: { tono: 'fucsia', glifo: G.comunicazioni },
  allenamenti: { tono: 'verde', glifo: G.allenamenti }, // macro Allenamenti
  presenze: { tono: 'smeraldo', glifo: G.presenze },
  partita: { tono: 'corallo', glifo: G.partita },       // macro Partite
  calendario: { tono: 'ciano', glifo: G.calendario },
  classifica: { tono: 'ambra', glifo: G.classifica },
  statistiche: { tono: 'indaco', glifo: G.statistiche },
  squadra: { tono: 'indaco', glifo: G.squadra },        // macro Societa'
  situazione: { tono: 'rosso', glifo: G.situazione },
  documenti: { tono: 'viola', glifo: G.documenti },
  finanza: { tono: 'smeraldo', glifo: G.finanza },
  utenti: { tono: 'ciano', glifo: G.utenti },
  profilo: { tono: 'viola', glifo: G.profilo }
};

export function IconaSezione({ id, dim = 26, className }) {
  const s = SEZIONI[id] || SEZIONI.home;
  return <Icona tono={s.tono} glifo={s.glifo} dim={dim} className={className} />;
}

export function coloreSezione(id) {
  return (SEZIONI[id] || SEZIONI.home).tono;
}

/* Il colore di una sezione scritto come lo vuole una variabile CSS: «56 124
   255», tre numeri senza virgole, da usare dentro rgb(var(--x) / 0.2).
   E' il primo dei due della coppia — quello con cui la sezione si riconosce —
   non il secondo, che serve solo a chiudere la sfumatura. */
export function tintaSezione(id) {
  const [chiaro] = TONI[(SEZIONI[id] || SEZIONI.home).tono] || TONI.blu;
  const n = parseInt(chiaro.slice(1), 16);
  return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255);
}



/* Icone di interfaccia: tratto sottile, monocromatiche, prendono il colore del
   testo. Sono un'altra famiglia di proposito — mettere un volume di vetro su
   una freccia farebbe pesare un dettaglio quanto una sezione. */
// Matita e croce: erano due caratteri di testo, e un carattere di testo
// dipende dal font di sistema — su Android la croce arrivava piu' sottile e
// piu' piccola della matita. Disegnate, sono due segni della stessa famiglia.
export function Matita({ dim = 16, className }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.4 3.3a1.9 1.9 0 0 1 2.7 2.7l-8.6 8.6-3.5.8.8-3.5 8.6-8.6Z" />
      <path d="m12.2 4.5 3.3 3.3" />
    </svg>
  );
}

export function Croce({ dim = 16, className }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m5.6 5.6 8.8 8.8M14.4 5.6l-8.8 8.8" />
    </svg>
  );
}

export function Chevron({ dim = 16, className }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Punto({ dim = 8, className }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 8 8" aria-hidden="true" className={className}>
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}
