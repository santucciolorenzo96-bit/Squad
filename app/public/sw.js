/* Il guscio dell'app, disponibile anche senza rete.
 *
 * Serve a una cosa sola, e nasce da una constatazione: la copia locale del
 * tabellino non vale niente se l'app non si apre. In palestra, senza segnale,
 * aprire SQUAD dava una pagina bianca — e dietro quella pagina bianca c'era
 * una partita salvata che nessuno poteva raggiungere.
 *
 * REGOLA UNICA: PRIMA LA RETE.
 *
 * Ogni richiesta va in rete per prima. Se la rete risponde, quella risposta
 * vince sempre e finisce anche in cache per la prossima volta. Solo quando la
 * rete non c'è si pesca dalla cache.
 *
 * È la scelta prudente, ed è deliberata: la cache-first sarebbe più veloce ma
 * significa servire una versione vecchia dell'app a chi ce l'ha già aperta —
 * si sistema un difetto, si pubblica, e chi lo segnalava continua a vederlo.
 * Un guscio offline che mente su quale versione stai usando fa più danni di
 * quanti ne eviti.
 *
 * Le chiamate a Supabase non passano di qui: sono un'altra origine, e una
 * risposta del database ripescata dalla cache sarebbe un dato falso presentato
 * come vero.
 */

const CACHE = 'squad-guscio-v1';

self.addEventListener('install', () => {
  // Niente elenco di file da precaricare: si riempie da sola navigando, e non
  // c'è una lista da tenere allineata a ogni build.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const vecchie = await caches.keys();
    await Promise.all(vecchie.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // database, font, tutto il resto: diretti

  e.respondWith(primaLaRete(req));
});

async function primaLaRete(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const salvata = await caches.match(req);
    if (salvata) return salvata;
    // Una schermata dell'app chiesta per la prima volta da offline: l'indirizzo
    // è diverso ma il documento è sempre quello.
    if (req.mode === 'navigate') {
      const radice = await caches.match('/');
      if (radice) return radice;
    }
    throw err;
  }
}
