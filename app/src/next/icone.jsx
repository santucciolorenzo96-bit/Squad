import React from 'react';

/* Icone di vetro.
 *
 * Costruite come nel riferimento: una forma sfalsata e ruotata dietro, il
 * volume principale davanti in sfumatura, e i dettagli incisi in bianco
 * traslucido. Non è decorazione — è quello che fa leggere l'insieme come un
 * sistema invece che come icone prese qua e là.
 *
 * Tre regole che tengono la serie coerente:
 *   1. la luce viene sempre da sopra-sinistra, quindi la sfumatura va dal
 *      chiaro in alto a sinistra allo scuro in basso a destra;
 *   2. la forma di dietro è sempre ruotata nello stesso verso e ha sempre la
 *      stessa opacità: se ogni icona ruota a modo suo la serie si sfalda;
 *   3. il glifo dentro è bianco traslucido, mai un secondo colore.
 *
 * Il colore non è arbitrario: ogni sezione ne tiene uno per sempre, così si
 * impara la posizione prima del nome.
 */

const TONI = {
  blu: ['#5B9BFF', '#1E5BE0'],
  rosa: ['#FF7FB0', '#E01E6E'],
  verde: ['#5FE3A6', '#12A868'],
  corallo: ['#FF9A7A', '#E24A22'],
  viola: ['#B39BFF', '#6D3FE0'],
  ambra: ['#FFC271', '#E08A15'],
  ciano: ['#63DCF0', '#128FA8']
};

let seme = 0;

// `glifo` disegna dentro un riquadro 0 0 24 24 centrato sul volume principale.
export function Icona({ tono = 'blu', dim = 26, glifo, className }) {
  const [chiaro, scuro] = TONI[tono] || TONI.blu;
  const id = 'ic' + (seme++);

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
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={chiaro} />
          <stop offset="1" stopColor={scuro} />
        </linearGradient>
      </defs>

      {/* La lastra dietro: stessa sfumatura, ruotata e traslucida. È lei a dare
          lo spessore, e va disegnata prima perché sta sotto. */}
      <rect
        className="icona-lastra"
        x="12" y="4" width="24" height="24" rx="8"
        fill={`url(#${id})`} opacity="0.42"
        transform="rotate(12 24 16)"
      />

      {/* Il volume principale. */}
      <rect className="icona-volume" x="4" y="10" width="26" height="26" rx="9" fill={`url(#${id})`} />

      {/* Il glifo, inciso. */}
      <g transform="translate(5 11)" fill="#fff" fillOpacity="0.92">
        {glifo}
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------------------
 * I glifi. Riquadro 24x24, disegnati pieni: a queste dimensioni un contorno
 * sottile sparisce, e il riferimento è fatto di forme piene.
 * ------------------------------------------------------------------------ */

const G = {
  // Casa
  home: <path d="M12 4.4 4.2 10.6v8.2c0 .7.6 1.2 1.2 1.2h3.4v-5.1h6.4V20h3.4c.7 0 1.2-.5 1.2-1.2v-8.2L12 4.4Z" />,

  // Rosa: tre figure, la squadra
  rosa: (
    <>
      <circle cx="8.4" cy="8.6" r="2.9" />
      <circle cx="16.2" cy="9.4" r="2.3" fillOpacity="0.72" />
      <path d="M3.2 19.2c0-2.9 2.3-4.7 5.2-4.7s5.2 1.8 5.2 4.7c0 .5-.4.8-.8.8H4c-.5 0-.8-.3-.8-.8Z" />
      <path d="M15.1 14.8c2.6 0 4.6 1.5 4.6 4 0 .6-.3 1.2-.9 1.2h-3.3c.2-2-.4-3.9-1.6-5.1a5 5 0 0 1 1.2-.1Z" fillOpacity="0.72" />
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

  // Squadra: lo scudetto
  squadra: (
    <>
      <path d="M12 2.6 4.4 5.4v6.2c0 4.3 3.1 8.2 7.6 9.8 4.5-1.6 7.6-5.5 7.6-9.8V5.4L12 2.6Z" fillOpacity="0.62" />
      <path d="m12 7.4 1.6 3.2 3.5.5-2.6 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.6-2.5 3.5-.5L12 7.4Z" />
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
export const SEZIONI = {
  home: { tono: 'blu', glifo: G.home },
  rosa: { tono: 'ciano', glifo: G.rosa },
  anagrafica: { tono: 'viola', glifo: G.anagrafica },
  partita: { tono: 'corallo', glifo: G.partita },
  allenamenti: { tono: 'verde', glifo: G.allenamenti },
  presenze: { tono: 'ciano', glifo: G.presenze },
  comunicazioni: { tono: 'viola', glifo: G.comunicazioni },
  classifica: { tono: 'ambra', glifo: G.classifica },
  statistiche: { tono: 'blu', glifo: G.statistiche },
  calendario: { tono: 'ambra', glifo: G.calendario },
  situazione: { tono: 'rosa', glifo: G.situazione },
  documenti: { tono: 'blu', glifo: G.documenti },
  utenti: { tono: 'ciano', glifo: G.utenti },
  squadra: { tono: 'rosa', glifo: G.squadra },
  finanza: { tono: 'verde', glifo: G.finanza },
  profilo: { tono: 'viola', glifo: G.profilo }
};

// Il colore di una sezione come NOME della variabile di tema, non come esadecimale:
// serve a chi deve tingere qualcosa di quel colore fuori dall'icona — l'alone
// della barra, per esempio — restando dentro la stessa tavolozza.
export function coloreSezione(id) {
  return (SEZIONI[id] || SEZIONI.home).tono;
}

export function IconaSezione({ id, dim = 26, className }) {
  const s = SEZIONI[id] || SEZIONI.home;
  return <Icona tono={s.tono} glifo={s.glifo} dim={dim} className={className} />;
}

/* Icone di interfaccia: tratto sottile, monocromatiche, prendono il colore del
   testo. Sono un'altra famiglia di proposito — mettere un volume di vetro su
   una freccia farebbe pesare un dettaglio quanto una sezione. */
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
