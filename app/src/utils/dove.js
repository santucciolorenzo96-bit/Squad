/* CASA O TRASFERTA: UNA DEFINIZIONE SOLA.
 *
 * Ce n'erano quattro, in quattro schermate, e non dicevano la stessa cosa:
 *
 *   — nel modulo del calendario:  «In casa» / «In trasferta»
 *   — nell'elenco del calendario: «casa» / «fuori»
 *   — nelle comunicazioni:        «casa» / «fuori»
 *   — nella scheda della Home:    «in casa» / «ospite»
 *
 * Quattro vocabolari per due stati sono già un fastidio. Ma il guaio vero era
 * nella scheda della Home, e non è una parola: lì l'etichetta era attaccata a
 * una SQUADRA e non alla PARTITA. Per una trasferta si leggeva
 *
 *     [Avversario]        [Noi]
 *       in casa           ospite
 *
 * e «in casa», letto di sfuggita accanto al nome che sta per primo, dice che
 * si gioca in casa. Il significato era giusto e la lettura era rovesciata — il
 * tipo di errore che non si corregge da solo, perché chi legge non ha motivo
 * di dubitare.
 *
 * Qui dentro il soggetto è sempre e solo UNO: la partita, dal nostro punto di
 * vista. «In casa» vuol dire che la giochiamo noi in casa nostra, sempre, in
 * ogni schermata.
 *
 * E c'è un terzo stato, che prima non esisteva e passava per il primo.
 * `home` è una colonna che può essere nulla: le partite caricate dal PDF del
 * calendario, quando il campo non si riconosce, arrivano senza. Il codice di
 * prima faceva `home === false ? 'fuori' : 'casa'`, quindi un dato MANCANTE
 * veniva mostrato come «casa» — una supposizione presentata come un fatto, e
 * chi parte per la trasferta non ha modo di accorgersene.
 */

export const CASA = 'casa';
export const TRASFERTA = 'trasferta';
export const IGNOTO = 'ignoto';

/** Dove si gioca, dal nostro punto di vista. Mai una supposizione. */
export function doveSiGioca(partita) {
  if (!partita) return IGNOTO;
  if (partita.home === true) return CASA;
  if (partita.home === false) return TRASFERTA;
  return IGNOTO;
}

const PAROLE = {
  [CASA]: { breve: 'Casa', lungo: 'In casa' },
  [TRASFERTA]: { breve: 'Trasferta', lungo: 'In trasferta' },
  // «Da definire» e non «Sconosciuto»: non è un difetto dei dati, è una cosa
  // che qualcuno deve ancora decidere, e detta così si capisce che va fatto.
  [IGNOTO]: { breve: 'Da definire', lungo: 'Campo da definire' }
};

/** La parola da mostrare. `lungo` per i titoli, breve per le pastiglie. */
export function etichettaDove(partita, { lungo = false } = {}) {
  const p = PAROLE[doveSiGioca(partita)];
  return lungo ? p.lungo : p.breve;
}

/* Il tono della pastiglia.
 *
 * Tre stati e tre toni, e il terzo non è una sfumatura del primo: «da
 * definire» è ambra perché è una cosa da fare, non uno stato in cui una
 * partita può restare.
 */
export function tonoDove(partita) {
  const d = doveSiGioca(partita);
  if (d === CASA) return 'buono';         // si gioca a casa nostra
  if (d === TRASFERTA) return 'neutro';   // si parte, e va saputo
  return 'attesa';                        // manca una decisione
}

export function siGiocaInCasa(partita) {
  return doveSiGioca(partita) === CASA;
}
