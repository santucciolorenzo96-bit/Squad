import { azioneDi } from './referto.js';
import { mmss } from './cronometro.js';
import { nomePeriodo } from './periodi.js';
import { dividiNome } from './format.js';

/* LE ULTIME COSE SEGNATE, RACCONTATE.
 *
 * Il registro delle azioni esiste da tempo e serve al referto: una riga per
 * ogni cosa che succede, in ordine, col periodo e — da quando c'è il
 * cronometro — l'ora. Ma chi segna non lo vedeva mai.
 *
 * Serve per una ragione sola, e non è la cronaca: è CONTROLLARE L'ULTIMA
 * REGISTRAZIONE. Nel flusso evento-prima si tocca l'evento e poi la faccia, e
 * i due tocchi avvengono in mezzo secondo mentre si guarda il campo: il dubbio
 * che viene dopo è «l'ho dato al sette o al nove?». Finora l'unica risposta era
 * il nome attaccato all'Annulla, che dice l'ultima e nient'altro. Tre righe
 * dicono anche se le due prima erano giuste.
 *
 * TRE FORME, perché il registro ne ha tre:
 *
 *   — un'azione di un nostro giocatore: `a` è il nome dell'azione, `p` è chi;
 *   — i punti degli avversari: `a: 'loro'`, con quanti in `n`;
 *   — una correzione a mano del nostro punteggio: `a: 'noi'`.
 *
 * Una riga che non si riconosce — un'azione tolta dalla configurazione, una
 * partita vecchia — si mostra col suo codice invece di essere saltata. Una
 * riga incomprensibile è meglio di una riga che non c'è: la prima si capisce
 * guardando, la seconda fa credere che quel tocco non sia mai arrivato.
 */

/* COME SI CHIAMA UN'AZIONE, QUANDO STA DA SOLA SU UNA RIGA.
 *
 * Nella colonna degli eventi le azioni stanno dentro un gruppo, e il gruppo
 * da` il contesto: sotto «Da due» l'etichetta «✓ Canestro» basta. In una riga
 * di cronologia il gruppo non c'e` piu`, e «✓ Canestro» puo` essere un due o
 * un tre — che e` esattamente il dato che si sta controllando.
 *
 * La regola non e` scritta a mano, perche` scritta a mano andrebbe aggiornata
 * a ogni azione nuova e nessuno se ne ricorderebbe: il gruppo si aggiunge
 * quando la stessa etichetta compare in PIU` DI UN GRUPPO. «✓ Canestro» sta
 * in «Da due» e in «Da tre», quindi diventa «✓ Canestro · Da due»; «Assist»
 * sta in un gruppo solo, e resta «Assist».
 */
function trovaAzione(sport, act) {
  const conf = (sport && sport.scout) || {};
  const gruppi = conf.groups || [];
  for (let i = 0; i < gruppi.length; i++) {
    const a = (gruppi[i].actions || []).find(x => x.act === act);
    if (a) return { azione: a, gruppo: gruppi[i] };
  }
  // Le catene (chi ha alzato, com'e` finito l'attacco): `azioneDi` le cerca.
  return { azione: azioneDi(sport, act), gruppo: null };
}

function etichettaAzione(sport, act) {
  const { azione, gruppo } = trovaAzione(sport, act);
  if (!azione) return null;
  if (!gruppo) return azione.label;
  const gruppi = ((sport && sport.scout) || {}).groups || [];
  let quante = 0;
  gruppi.forEach(gr => {
    (gr.actions || []).forEach(x => { if (x.label === azione.label) quante += 1; });
  });
  return quante > 1 ? azione.label + ' · ' + gruppo.label : azione.label;
}

/* Il racconto di una voce sola. `indice` serve come chiave di disegno: il
 * registro cresce in fondo, e l'annulla lo accorcia, quindi la posizione è
 * stabile per le poche righe che si mostrano. */
function raccontaVoce(v, indice, sport, perId, g) {
  const conf = (sport && sport.scout) || {};
  const comune = {
    chiave: indice,
    periodo: nomePeriodo(conf, v.q, { amichevole: !!(g && g.friendly), breve: true }),
    // `t` manca nelle partite segnate prima del cronometro, e nella pallavolo
    // dove un cronometro non c'è: in quel caso resta solo il periodo.
    tempo: v.t == null ? '' : mmss(v.t)
  };

  if (v.a === 'loro') {
    const n = Number(v.n) || 0;
    return {
      ...comune,
      cosa: (g && g.oppName) || 'Avversari',
      chi: (n > 0 ? '+' : '') + n,
      tono: 'avversario',
      nostra: false
    };
  }

  if (v.a === 'noi') {
    const n = Number(v.n) || 0;
    return {
      ...comune,
      cosa: 'Punteggio corretto',
      chi: (n > 0 ? '+' : '') + n,
      tono: 'neutral',
      nostra: true
    };
  }

  const { azione } = trovaAzione(sport, v.a);
  const etichetta = etichettaAzione(sport, v.a);
  const p = perId[v.p];
  const { cognome, nome } = dividiNome(p && p.name);
  return {
    ...comune,
    cosa: etichetta || String(v.a || '?'),
    // Il cognome e non il nome intero: in una colonna stretta il nome intero
    // viene tagliato, e quello che si taglia è la metà che distingue.
    chi: p
      ? (String(p.number || '').trim() !== '' ? '#' + p.number + ' ' : '') + (cognome || nome)
      : '',
    tono: (azione && azione.tone) || 'neutral',
    nostra: true
  };
}

/* Le ultime `quante`, dalla più recente. Dalla più recente perché è quella di
 * cui si dubita: metterla in fondo vorrebbe dire cercarla ogni volta. */
export function cronaca(g, sport, { quante = 3 } = {}) {
  const storia = Array.isArray(g && g.storia) ? g.storia : [];
  const perId = {};
  ((g && g.players) || []).forEach(p => { if (p && p.id != null) perId[p.id] = p; });

  const fuori = [];
  for (let i = storia.length - 1; i >= 0 && fuori.length < quante; i--) {
    if (storia[i]) fuori.push(raccontaVoce(storia[i], i, sport, perId, g));
  }
  return fuori;
}
