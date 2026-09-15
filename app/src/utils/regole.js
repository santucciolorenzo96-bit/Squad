/* Il regolamento, per quanto serve a chi segna.
 *
 * Non tutti gli sport hanno una regola che dice quando un periodo finisce: nel
 * basket il quarto finisce quando finisce il tempo, e il punteggio non c'entra.
 * Nella pallavolo invece il set finisce ESATTAMENTE quando i numeri lo dicono —
 * 25 punti con due di scarto, 15 nel quinto — e la partita al terzo set vinto.
 *
 * Dove la regola c'è, l'app la sa. Serve a tre cose, in ordine di utilità:
 *
 *   1. dire «set point» mentre si gioca, che è l'informazione che in panchina
 *      si chiede ad alta voce;
 *   2. proporre la chiusura quando il set È finito, invece di lasciare che ci
 *      si accorga dopo tre punti che il set era chiuso da tre punti;
 *   3. rifiutare un punteggio impossibile alla chiusura. Un set 25-24 non
 *      esiste: se è quello che si sta scrivendo, è sfuggito un punto — e
 *      questo è l'ultimo momento in cui è ancora facile accorgersene.
 *
 * Dove la regola non c'è — basket, calcio — tutte le funzioni si tirano
 * indietro restituendo null, e niente cambia.
 */

// Dove sta il periodo in corso.
//
//   gioco   nessuno dei due può chiuderlo al prossimo punto
//   palla   uno dei due lo chiude al prossimo punto (set point)
//   chiuso  è già finito: i numeri non possono più cambiare
export function situazionePeriodo(conf, numeroPeriodo, us, them) {
  const r = conf && conf.regolamento;
  if (!r) return null;
  const soglia = r.sogliaPeriodo(numeroPeriodo);
  const alto = Math.max(us, them);
  const basso = Math.min(us, them);
  const chi = us === them ? null : (us > them ? 'us' : 'them');

  if (alto >= soglia && alto - basso >= r.scarto) return { stato: 'chiuso', chi, soglia };
  // Set point: chi è avanti arriverebbe alla soglia — o oltre, se si è andati
  // ai vantaggi — e con il punto successivo avrebbe anche lo scarto.
  if (chi && alto >= soglia - 1 && alto - basso >= r.scarto - 1) return { stato: 'palla', chi, soglia };
  return { stato: 'gioco', chi: null, soglia };
}

// I set vinti da una parte e dall'altra, contando solo i periodi già chiusi.
export function periodiVinti(periodiChiusi) {
  let us = 0, them = 0;
  (periodiChiusi || []).forEach(p => {
    if (!p) return;
    if (p.us > p.them) us += 1;
    else if (p.them > p.us) them += 1;
  });
  return { us, them };
}

// La partita è finita quando uno dei due ha vinto abbastanza set. Restituisce
// null dove non c'è una regola, così chi chiama non deve saperlo.
export function partitaDecisa(conf, periodiChiusi) {
  const r = conf && conf.regolamento;
  if (!r) return null;
  const v = periodiVinti(periodiChiusi);
  if (v.us >= r.periodiPerVincere) return { finita: true, chi: 'us', ...v };
  if (v.them >= r.periodiPerVincere) return { finita: true, chi: 'them', ...v };
  return { finita: false, chi: null, ...v };
}

// «Set point» diventa «match point» quando quel set è anche l'ultimo che
// serve. È la differenza che in panchina cambia tutto, e costa una riga.
export function etichettaPalla(conf, situazione, periodiChiusi) {
  const r = conf && conf.regolamento;
  if (!r || !situazione || situazione.stato !== 'palla') return null;
  const v = periodiVinti(periodiChiusi);
  const suoi = situazione.chi === 'us' ? v.us : v.them;
  return suoi >= r.periodiPerVincere - 1 ? r.etichettaMatch : r.etichettaPalla;
}

/* Un punteggio che il regolamento non permette.
 *
 * Restituisce la spiegazione, o null se va bene. Non è pignoleria da
 * archivista: il punteggio si copia dal tabellone della palestra, e il
 * tabellone della palestra il regolamento lo rispetta sempre. Se quello che
 * stiamo per scrivere è impossibile, l'errore è nostro.
 */
export function perchePunteggioImpossibile(conf, numeroPeriodo, us, them, etichetta) {
  const r = conf && conf.regolamento;
  if (!r) return null;
  const nome = (etichetta || 'periodo').toLowerCase();
  const soglia = r.sogliaPeriodo(numeroPeriodo);
  const alto = Math.max(us, them);
  const basso = Math.min(us, them);

  if (us === them) {
    return 'Un ' + nome + ' non può finire in parità: si continua finché uno dei due non prende due punti di scarto.';
  }
  if (alto < soglia) {
    return 'Un ' + nome + ' si chiude a ' + soglia + ' punti: ' + us + '-' + them + ' non è un punteggio finale.';
  }
  if (alto - basso < r.scarto) {
    return 'Servono ' + r.scarto + ' punti di scarto: da ' + us + '-' + them + ' si continua a giocare.';
  }
  // Oltre la soglia si va solo ai vantaggi, e ai vantaggi si chiude sul primo
  // scarto di due: 27-25 esiste, 28-25 no.
  if (alto > soglia && alto - basso > r.scarto) {
    return 'Oltre i ' + soglia + ' punti il ' + nome + ' si chiude al primo scarto di ' + r.scarto
      + ': con ' + basso + ' all’avversario il massimo possibile è ' + (basso + r.scarto) + '.';
  }
  return null;
}

// Quanti periodi si possono ancora giocare. Serve a non proporre un sesto set.
export function periodiMassimi(conf) {
  const r = conf && conf.regolamento;
  return r ? r.periodiMassimi : null;
}
