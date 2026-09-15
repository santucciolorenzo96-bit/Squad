/* La copia locale del tabellino.
 *
 * In palestra la rete non c'è. Non «è lenta»: non c'è, per venti minuti, e poi
 * torna. Finora l'app se ne accorgeva e lo diceva — ma continuava a tenere il
 * tabellino solo in memoria, e una scheda chiusa per sbaglio, un telefono che
 * si riavvia o una batteria finita si portavano via due ore di lavoro senza
 * lasciare niente.
 *
 * Qui il tabellino viene scritto SUBITO nel browser, a ogni azione, prima
 * ancora di provare a mandarlo al server: scrivere in locale è immediato e non
 * può fallire per colpa della rete. Il server resta la verità — è lui che
 * vedono gli altri — ma smette di essere l'unico posto dove la partita esiste.
 *
 * `sincronizzata` dice se quello che c'è qui è già arrivato anche là. È
 * l'unica cosa che serve sapere per decidere, alla riapertura, quale delle due
 * copie è avanti.
 */

const PREFISSO = 'squad_partita_';

function chiave(sectorId) {
  return PREFISSO + sectorId;
}

// Ogni accesso è protetto: in navigazione privata, con lo spazio esaurito o
// con i dati del sito bloccati, localStorage non solleva un avviso — solleva
// un'eccezione. Una partita non si deve fermare per questo.
function leggiGrezzo(sectorId) {
  try {
    const t = window.localStorage.getItem(chiave(sectorId));
    return t ? JSON.parse(t) : null;
  } catch (e) {
    return null;
  }
}

function scriviGrezzo(sectorId, valore) {
  try {
    window.localStorage.setItem(chiave(sectorId), JSON.stringify(valore));
    return true;
  } catch (e) {
    return false;
  }
}

// Restituisce il timbro della copia appena scritta: serve dopo, per capire se
// il salvataggio che è andato a buon fine riguardava ancora QUESTA copia.
export function scriviCopia(gioco) {
  if (!gioco || !gioco.sectorId) return null;
  const timbro = new Date().toISOString();
  const ok = scriviGrezzo(gioco.sectorId, {
    v: 1,
    gameId: gioco.id,
    sectorId: gioco.sectorId,
    salvataAlle: timbro,
    sincronizzata: false,
    gioco
  });
  return ok ? timbro : null;
}

// Segna come arrivata al server una copia precisa. Il controllo sul timbro non
// è pignoleria: fra la partenza della richiesta e la sua risposta si segnano
// altre azioni, e dire «sincronizzata» di una copia più recente di quella
// appena spedita vorrebbe dire perderla senza accorgersene.
export function segnaSincronizzata(sectorId, timbro) {
  if (!timbro) return;
  const c = leggiGrezzo(sectorId);
  if (!c || c.salvataAlle !== timbro) return;
  scriviGrezzo(sectorId, { ...c, sincronizzata: true });
}

export function leggiCopia(sectorId) {
  const c = leggiGrezzo(sectorId);
  return c && c.gioco ? c : null;
}

export function cancellaCopia(sectorId) {
  try { window.localStorage.removeItem(chiave(sectorId)); } catch (e) { /* niente */ }
}

// Da quanto tempo aspetta di partire. Serve solo a scriverlo in chiaro
// all'utente: «non salvata da sei minuti» dice quanto si rischia, «non
// salvata» no.
export function daQuanto(copia) {
  if (!copia || !copia.salvataAlle) return null;
  const min = Math.floor((Date.now() - new Date(copia.salvataAlle).getTime()) / 60000);
  if (min < 1) return 'meno di un minuto fa';
  if (min === 1) return 'un minuto fa';
  if (min < 60) return min + ' minuti fa';
  const ore = Math.floor(min / 60);
  return ore === 1 ? "un'ora fa" : ore + ' ore fa';
}
