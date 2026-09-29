/* La rotazione della pallavolo, e il cambio del libero.
 *
 * COME SONO NUMERATE LE ZONE
 *
 * Il sestetto in campo è un ELENCO ORDINATO, e la posizione nell'elenco è la
 * zona: indice 0 = zona 1, 1 = zona 2, e così via fino a 5 = zona 6. Ruotare
 * vuol dire spostare il primo in fondo — chi era in zona 1 va in 6, e tutti
 * gli altri avanzano di un posto.
 *
 *        rete
 *    4    3    2      <- prima linea, indici 3, 2, 1
 *    5    6    1      <- seconda linea, indici 4, 5, 0   (in zona 1 si batte)
 *
 * IL CAMBIO DEL LIBERO
 *
 * Il libero gioca al posto del centrale che sta in seconda linea, e non può
 * battere. Da queste due cose discende tutto il resto, senza bisogno di
 * ricordarsi le regole a memoria:
 *
 *   ESCE quando la rotazione lo porterebbe in PRIMA LINEA. È il momento che si
 *   riconosce guardando l'altro centrale: quello che stava in zona 2 arriva in
 *   zona 1 e deve battere, e contemporaneamente il centrale coperto dal libero
 *   arriva in zona 4. Il libero lascia il campo e quel centrale rientra.
 *
 *   ENTRA quando un centrale arriva in ZONA 6. Ci arriva da zona 1, cioè ha
 *   appena finito il suo turno di battuta: da lì in poi è un giocatore di
 *   seconda linea come gli altri, e il libero prende il suo posto.
 *
 * QUANDO NON SI È SICURI, NON SI TOCCA NIENTE
 *
 * Nessun libero, nessun centrale in panchina, ruoli non compilati: la funzione
 * risponde null e il sestetto resta come l'ha lasciato chi segna. Un cambio
 * sbagliato a inizio set sposta le persone per tutto il set senza che nessuno
 * se ne accorga, ed è molto peggio di un cambio non fatto — quello si vede
 * subito, perché in campo c'è il libero in attacco.
 */

export const PRIMA_LINEA = [3, 2, 1];   // indici delle zone 4, 3, 2
export const SECONDA_LINEA = [4, 5, 0]; // indici delle zone 5, 6, 1
export const ZONA_6 = 5;
export const ZONA_1 = 0;

// La zona (1..6) di un indice dell'elenco, per parlarne con chi segna.
export function zonaDi(indice) {
  return indice + 1;
}

function ruolo(p) {
  return String((p && p.role_position) || '').trim().toLowerCase();
}

export function eLibero(p) { return ruolo(p) === 'libero'; }
export function eCentrale(p) { return ruolo(p) === 'centrale'; }

/* Ruotare: chi era in zona 1 va in zona 6, e tutti gli altri avanzano.
 *
 * Torna un elenco nuovo e non tocca quello ricevuto: è una funzione, non un
 * gesto. Chi la chiama decide cosa farne.
 */
export function ruotaSestetto(sestetto) {
  if (!Array.isArray(sestetto) || sestetto.length < 2) return sestetto || [];
  return sestetto.slice(1).concat([sestetto[0]]);
}

/* Il cambio dovuto DOPO una rotazione, oppure null.
 *
 * `perChi` è l'id del centrale che il libero sta sostituendo: serve quando in
 * panchina ci sono tutti e due i centrali e bisogna far rientrare quello
 * giusto. Se manca si prende il primo centrale disponibile, che è la scelta
 * corretta nel caso normale — due centrali, uno dentro e uno fuori.
 */
export function cambioLibero(sestetto, panchina, perChi) {
  if (!Array.isArray(sestetto) || sestetto.length < 6) return null;
  const fuori = Array.isArray(panchina) ? panchina : [];

  const doveIlLibero = sestetto.findIndex(eLibero);

  // 1. Il libero è finito in prima linea: deve uscire, e rientra il centrale
  //    per cui era entrato.
  if (doveIlLibero >= 0 && PRIMA_LINEA.indexOf(doveIlLibero) >= 0) {
    const suo = fuori.find(p => p.id === perChi && eCentrale(p));
    const centrale = suo || fuori.find(eCentrale);
    if (!centrale) return null;
    return {
      esce: sestetto[doveIlLibero],
      entra: centrale,
      indice: doveIlLibero,
      zona: zonaDi(doveIlLibero),
      motivo: 'prima-linea'
    };
  }

  // 2. Nessun libero in campo e un centrale è arrivato in zona 6: ha appena
  //    finito di battere, e il libero prende il suo posto.
  if (doveIlLibero < 0) {
    const libero = fuori.find(eLibero);
    if (!libero) return null;
    if (eCentrale(sestetto[ZONA_6])) {
      return {
        esce: sestetto[ZONA_6],
        entra: libero,
        indice: ZONA_6,
        zona: zonaDi(ZONA_6),
        motivo: 'seconda-linea'
      };
    }
  }

  return null;
}

/* Il cambio applicato: l'elenco nuovo, con `entra` al posto di `esce`.
 *
 * Separato dal calcolo perché la stessa decisione serve anche solo per
 * raccontarla — «esce il libero, entra Bianchi in zona 4» — e raccontarla non
 * deve costare uno spostamento.
 */
export function applicaCambio(sestetto, cambio) {
  if (!cambio) return sestetto;
  return sestetto.map((p, i) => (i === cambio.indice ? cambio.entra : p));
}

/* ======================================================================== */
/* LA DIREZIONE DI UNA TRAIETTORIA                                          */
/* ======================================================================== */
/*
 * Un attacco parte dal nostro campo e cade nel loro. Non è una convenzione di
 * disegno: è il gioco. Una traiettoria tirata al contrario — dal loro campo
 * verso il nostro — descrive un attacco avversario, e sulla mappa dei nostri
 * punti non ci deve stare.
 *
 * Il campo intero va da 0 a 100 in larghezza con la rete in mezzo: fino a 50
 * siamo noi, oltre sono loro. Chi disegna lo vede scritto sul campo, ma il
 * dito su un telefono parte dove capita — e una riga sbagliata registrata una
 * volta resta nel referto per sempre.
 */
export const RETE = 50;

export function versoGiusto(da, a) {
  if (!da || !a) return false;
  return da.x < RETE && a.x > RETE;
}

/* Perché non va bene, detto a chi sta segnando.
 *
 * Tre casi diversi e tre frasi diverse: «parte dal campo sbagliato» e «non
 * supera la rete» si correggono con due gesti diversi, e un messaggio unico
 * costringerebbe a indovinare quale.
 */
export function perchePalla(da, a) {
  if (!da || !a) return 'Traccia la traiettoria con un dito, dal nostro campo al loro.';
  if (da.x >= RETE && a.x <= RETE) return 'L’hai disegnata al contrario: parte dal nostro campo e cade nel loro.';
  if (da.x >= RETE) return 'La palla parte dal nostro campo, a sinistra della rete.';
  if (a.x <= RETE) return 'La palla deve cadere oltre la rete, nel campo avversario.';
  return null;
}

// Come si dice a voce, per l'avviso che compare a chi segna.
export function raccontaCambio(cambio) {
  if (!cambio) return '';
  const nome = (p) => (p && (p.name || '').split(' ')[0]) || 'giocatore';
  return cambio.motivo === 'prima-linea'
    ? `Esce il libero, entra ${nome(cambio.entra)} in zona ${cambio.zona}`
    : `Entra il libero per ${nome(cambio.esce)} in zona ${cambio.zona}`;
}
