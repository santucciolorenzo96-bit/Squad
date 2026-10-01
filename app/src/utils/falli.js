/* I FALLI DI UN GIOCATORE, E QUANTO MANCA A USCIRE.
 *
 * Al quinto fallo si esce. È la regola, ed è anche la cosa che chi segna deve
 * poter vedere con la coda dell'occhio — senza aprire niente e senza contare a
 * mente. Sotto il gettone di ogni giocatore in campo ci sono cinque trattini,
 * e si riempiono.
 *
 * Non basta il totale: i tre tipi si distinguono. Un tecnico e un antisportivo
 * non sono un fallo in più qualunque, e un allenatore che guarda il tabellino
 * vuole sapere quale dei cinque è stato cosa. L'ORDINE conta: «due personali,
 * poi un tecnico» racconta una partita diversa da «un tecnico e poi due
 * personali».
 *
 * L'ordine non sta nelle statistiche — lì ci sono solo i conteggi — ma sta nel
 * REGISTRO delle azioni, che è la cronaca in ordine di tutto quello che è
 * successo. Da lì si ricava, e si ricava anche per le partite già archiviate.
 */

// I nomi delle azioni che sono un fallo del giocatore, e il tipo che valgono.
export const TIPI_FALLO = {
  pf: 'personale',
  pf_tecnico: 'tecnico',
  pf_antisportivo: 'antisportivo'
};

/** I falli di ogni giocatore, in ordine: { [idGiocatore]: ['personale', ...] } */
export function falliPerGiocatore(g) {
  const per = {};
  const storia = (g && Array.isArray(g.storia)) ? g.storia : [];
  storia.forEach(v => {
    if (!v || !v.p) return;
    const tipo = TIPI_FALLO[v.a];
    if (!tipo) return;
    if (!per[v.p]) per[v.p] = [];
    per[v.p].push(tipo);
  });
  return per;
}

/* I trattini da disegnare sotto un gettone.
 *
 * Il TOTALE comanda, non la sequenza: `pf` è il numero da cui dipende
 * l'uscita, ed è quello che il tabellino salva e che il database conosce. La
 * sequenza serve solo a dire di che TIPO era ciascuno.
 *
 * Quando le due cose non coincidono vince il totale. Succede davvero: le
 * partite segnate prima che il registro esistesse hanno i falli nel tabellino
 * e non nella cronaca, e lì i trattini devono comparire lo stesso — si
 * riempiono come personali, che è quello che quasi sempre erano.
 */
export function segniFallo(stats, sequenza, quanti = 5) {
  const tot = Math.max(0, Math.round(Number((stats || {}).pf) || 0));
  let tipi = Array.isArray(sequenza) ? sequenza.slice() : [];
  if (tipi.length > tot) tipi = tipi.slice(0, tot);
  // I falli che il registro non conosce sono i più VECCHI: la cronaca, quando
  // c'è, è sempre la coda della partita.
  while (tipi.length < tot) tipi.unshift('personale');

  const segni = [];
  for (let i = 0; i < quanti; i++) segni.push(i < tot ? tipi[i] : null);

  return {
    segni,
    tot,
    // Al quinto si esce. Da qui in avanti quel giocatore non può più stare in
    // campo, e il gettone lo deve gridare.
    fuori: tot >= quanti,
    // Un sesto fallo non si disegna: non ci sono sei caselle. Si scrive.
    oltre: Math.max(0, tot - quanti)
  };
}

/* Il racconto a parole, per chi non vede i colori e per chi passa il dito
 * sopra. Cinque trattini colorati sono un'informazione che deve esistere anche
 * senza colore. */
export function raccontaFalli(s) {
  if (!s || !s.tot) return 'Nessun fallo';
  const conta = {};
  s.segni.filter(Boolean).forEach(t => { conta[t] = (conta[t] || 0) + 1; });
  const pezzi = [];
  if (conta.personale) pezzi.push(conta.personale + (conta.personale === 1 ? ' fallo' : ' falli'));
  if (conta.tecnico) pezzi.push(conta.tecnico + (conta.tecnico === 1 ? ' tecnico' : ' tecnici'));
  if (conta.antisportivo) {
    pezzi.push(conta.antisportivo + (conta.antisportivo === 1 ? ' antisportivo' : ' antisportivi'));
  }
  return pezzi.join(', ') + (s.fuori ? ' — fuori per falli' : '');
}
