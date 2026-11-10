import React, { useRef } from 'react';
import {
  CAMPO, ID_ATTACCO, ID_DIFESA, accorcia, testaFreccia, percorsoOndulato, sbarraBlocco, distanza
} from '../utils/schemi.js';

/* IL CAMPO DEGLI SCHEMI.
 *
 * Mezzo campo FIBA disegnato con le misure vere (15 x 14 m, unita' da 10 cm):
 * l'area dei tre secondi, il semicerchio, la linea dei tre punti, il cerchio
 * del tiro libero. Chi guarda uno schema ci ritrova la palestra, non un
 * diagramma.
 *
 * E` una lavagna, e come una lavagna ha sempre lo stesso aspetto: scuro, con
 * le linee chiare, qualunque sia il tema dell'app. Cambiarlo col tema
 * vorrebbe dire che lo stesso schema ha due facce, e che i colori delle frecce
 * — che portano il significato — vanno scelti due volte.
 *
 * PRESENTAZIONALE: non sa cosa sia uno schema. Riceve le posizioni e le frecce
 * gia` calcolate, e se `interattivo` dice all'esterno quando un giocatore e`
 * toccato o trascinato. Lo usano il lettore, l'editor e le anteprime.
 */

const R = 6.4;                 // raggio di un giocatore
const R_TOCCO = 12.5;          // area sensibile: piu' larga del cerchio, per il dito
const COLORI = {
  campo: '#0f1a30',
  area: 'rgba(96,165,250,0.10)',
  linea: 'rgba(226,232,240,0.62)',
  taglio: '#bfdbfe',
  palleggio: '#fcd34d',
  blocco: '#f0abfc',
  passaggio: '#fb923c',
  attacco: '#3b82f6',
  attaccoBordo: '#bfdbfe',
  difesa: '#7f1d1d',
  difesaBordo: '#fca5a5',
  selezione: '#fbbf24',
  palla: '#f97316'
};

/* Le linee del campo, una volta sola: non cambiano mai. */
const Linee = React.memo(function Linee() {
  const l = { fill: 'none', stroke: COLORI.linea, strokeWidth: 1.1, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <g>
      <rect x="0" y="0" width={CAMPO.w} height={CAMPO.h} rx="2" fill={COLORI.campo} />
      {/* L'area dei tre secondi: 4,9 m per 5,8 m. */}
      <rect x="50.5" y="0" width="49" height="58" fill={COLORI.area} />
      <rect x="50.5" y="0" width="49" height="58" {...l} />
      {/* Tiro libero: la meta` verso il campo piena, quella verso l'area tratteggiata. */}
      <path d="M57 58 A18 18 0 0 0 93 58" {...l} />
      <path d="M57 58 A18 18 0 0 1 93 58" {...l} strokeDasharray="3.2 3" />
      {/* Semicerchio dei non sfondamento: 1,25 m dal canestro. */}
      <path d="M62.5 0 V15.75 A12.5 12.5 0 0 0 87.5 15.75 V0" {...l} />
      {/* La linea dei tre punti: 6,75 m, con i lati a 0,9 m dalla linea laterale. */}
      <path d="M9 0 V29.9 A67.5 67.5 0 0 0 141 29.9 V0" {...l} />
      {/* Tabellone e ferro. */}
      <line x1="66" y1="12" x2="84" y2="12" stroke="rgba(226,232,240,0.9)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="75" cy="15.75" r="2.25" fill="none" stroke="#fb923c" strokeWidth="1.4" />
      {/* Il cerchio di meta` campo. */}
      <path d="M57 140 A18 18 0 0 1 93 140" {...l} />
      <rect x="0" y="0" width={CAMPO.w} height={CAMPO.h} rx="2" {...l} strokeWidth="1.4" />
    </g>
  );
});

function Freccia({ da, a, tipo }) {
  const fine = accorcia(da, a, R + 1.2);
  const inizio = accorcia(a, da, R + 0.5);
  if (distanza(inizio, fine) < 3) return null;

  if (tipo === 'palleggio') {
    return (
      <g>
        <path d={percorsoOndulato(inizio, fine)} fill="none" stroke={COLORI.palleggio} strokeWidth="1.6" strokeLinecap="round" />
        <polygon points={testaFreccia(inizio, fine)} fill={COLORI.palleggio} />
      </g>
    );
  }
  if (tipo === 'blocco') {
    const b = sbarraBlocco(inizio, fine);
    return (
      <g stroke={COLORI.blocco} strokeWidth="1.8" strokeLinecap="round">
        <line x1={inizio.x} y1={inizio.y} x2={fine.x} y2={fine.y} />
        <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} strokeWidth="2.4" />
      </g>
    );
  }
  return (
    <g>
      <line x1={inizio.x} y1={inizio.y} x2={fine.x} y2={fine.y} stroke={COLORI.taglio} strokeWidth="1.6" strokeLinecap="round" />
      <polygon points={testaFreccia(inizio, fine)} fill={COLORI.taglio} />
    </g>
  );
}

function Passaggio({ da, a, tiro }) {
  const inizio = accorcia(a, da, R + 1);
  const fine = tiro ? accorcia(da, a, 4) : accorcia(da, a, R + 1.2);
  if (distanza(inizio, fine) < 3) return null;
  return (
    <g>
      <line
        x1={inizio.x} y1={inizio.y} x2={fine.x} y2={fine.y}
        stroke={COLORI.passaggio} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3.4 2.6"
      />
      <polygon points={testaFreccia(inizio, fine)} fill={COLORI.passaggio} />
    </g>
  );
}

function Giocatore({ id, p, selezionato, interattivo, compatto, onDown }) {
  const difesa = ID_DIFESA.includes(id);
  const numero = id.slice(1);
  return (
    <g
      transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
      onPointerDown={interattivo ? (e) => onDown(e, id) : undefined}
      style={interattivo ? { touchAction: 'none', cursor: 'grab' } : undefined}
    >
      {interattivo && <circle r={R_TOCCO} fill="transparent" />}
      {selezionato && (
        <circle r={R + 3} fill="none" stroke={COLORI.selezione} strokeWidth="1.8" />
      )}
      <circle
        r={R}
        fill={difesa ? COLORI.difesa : COLORI.attacco}
        stroke={difesa ? COLORI.difesaBordo : COLORI.attaccoBordo}
        strokeWidth="1.2"
      />
      <text
        y="0.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={compatto ? 8.2 : 7.8}
        fontWeight="700"
        fill="#fff"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {numero}
      </text>
    </g>
  );
}

export function SchemiCampo({
  pos, palla, movimenti = [], passaggio = null, fantasmi = null,
  selezionato = null, interattivo = false, compatto = false,
  onSeleziona, onSposta, className
}) {
  const svg = useRef(null);
  const trascina = useRef(null);

  function punto(e) {
    const s = svg.current;
    const m = s && s.getScreenCTM && s.getScreenCTM();
    if (!m || !s.createSVGPoint) return null;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }

  function giu(e, id) {
    const q = punto(e);
    const g = pos[id];
    if (!q || !g) return;
    /* LA CATTURA STA SUL CAMPO, NON SUL GIOCATORE.
       Il giocatore toccato viene portato in cima nel disegno, e spostare un nodo
       nel documento fa rilasciare la cattura a diversi browser: il primo
       trascinamento si interromperebbe appena la selezione riordina i cerchi. Il
       riquadro del campo non si sposta mai, quindi il dito resta agganciato fino
       al rilascio. */
    try { svg.current.setPointerCapture(e.pointerId); } catch (err) { /* un tocco sparito */ }
    // Si tiene la distanza fra il dito e il centro: il giocatore non salta sotto
    // il dito, si muove con lui.
    trascina.current = { id, dx: g.x - q.x, dy: g.y - q.y, cx: e.clientX, cy: e.clientY, mosso: false };
    if (onSeleziona) onSeleziona(id);
  }

  function muovi(e) {
    const t = trascina.current;
    if (!t) return;
    const id = t.id;
    // Sotto qualche pixel e` ancora un tocco, non un trascinamento: un dito non
    // sta mai perfettamente fermo.
    if (!t.mosso && Math.hypot(e.clientX - t.cx, e.clientY - t.cy) < 4) return;
    t.mosso = true;
    const q = punto(e);
    if (q && onSposta) onSposta(id, q.x + t.dx, q.y + t.dy);
  }

  function su() {
    trascina.current = null;
  }

  const ordine = [...ID_DIFESA, ...ID_ATTACCO].filter(id => pos[id]);
  // Il selezionato sta sopra: se due cerchi si sovrappongono, quello che si sta
  // spostando non puo` finire sotto l'altro.
  if (selezionato && pos[selezionato]) {
    ordine.splice(ordine.indexOf(selezionato), 1);
    ordine.push(selezionato);
  }

  return (
    <svg
      ref={svg}
      viewBox={`-3 -3 ${CAMPO.w + 6} ${CAMPO.h + 6}`}
      className={className || 'block h-auto w-full select-none'}
      onPointerMove={interattivo ? muovi : undefined}
      onPointerUp={interattivo ? su : undefined}
      onPointerCancel={interattivo ? su : undefined}
      role="img"
      aria-label="Mezzo campo da basket con la posizione dei giocatori"
    >
      <Linee />

      {!compatto && fantasmi && Object.keys(fantasmi).map(id => (
        <circle
          key={'f' + id}
          cx={fantasmi[id].x} cy={fantasmi[id].y} r={R}
          fill="none"
          stroke={ID_DIFESA.includes(id) ? COLORI.difesaBordo : COLORI.attaccoBordo}
          strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="2.4 2.4"
        />
      ))}

      {!compatto && movimenti.map(m => <Freccia key={'m' + m.id} da={m.da} a={m.a} tipo={m.tipo} />)}
      {!compatto && passaggio && <Passaggio da={passaggio.da} a={passaggio.a} tiro={passaggio.tiro} />}

      {ordine.map(id => (
        <Giocatore
          key={id}
          id={id}
          p={pos[id]}
          selezionato={selezionato === id}
          interattivo={interattivo}
          compatto={compatto}
          onDown={giu}
        />
      ))}

      {palla && (
        <g transform={`translate(${palla.x.toFixed(2)} ${palla.y.toFixed(2)})`} style={{ pointerEvents: 'none' }}>
          <circle r="3.4" fill={COLORI.palla} stroke="#7c2d12" strokeWidth="0.9" />
          <path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#7c2d12" strokeWidth="0.55" />
        </g>
      )}
    </svg>
  );
}

export { COLORI as COLORI_CAMPO };
