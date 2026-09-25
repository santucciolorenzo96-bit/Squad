/* Le notifiche, lette.
 *
 * Il database le scrive già da un anno: ogni allenamento creato, spostato o
 * annullato, ogni documento caricato o verificato, ogni comunicazione lascia
 * una riga. Nel ridisegno dell'interfaccia la campanella non è stata
 * ricostruita, e quelle righe hanno continuato ad accumularsi senza che
 * nessuno potesse vederle.
 *
 * Qui ci sono le due cose che servono per leggerle, e che prima non c'erano:
 *
 *  - DA DOVE VIENE la notifica. Un elenco di dieci righe tutte uguali obbliga
 *    a leggerle tutte per sapere di cosa parlano. Con l'icona della sezione
 *    di provenienza si riconosce a colpo d'occhio se è roba di allenamenti,
 *    di anagrafica o di partite.
 *  - CHE COSA è cambiato. Non «Allenamento aggiornato», che vale per
 *    qualunque modifica di qualunque allenamento, ma quale allenamento e cosa
 *    gli è successo.
 *
 * Tutto quello che c'è qui è calcolo puro su righe già scaricate: nessuna
 * richiesta, niente React. Così si può provare.
 */

/* Ogni tipo di notifica viene da una sezione e racconta un tipo di modifica.
 *
 * `sezione` è anche l'icona: sono le stesse chiavi del menu, quindi una
 * notifica che viene dagli allenamenti porta l'icona degli allenamenti, con
 * lo stesso colore che ha nella barra. Non c'è una seconda famiglia di icone
 * da imparare.
 *
 * `azione` è la parola sopra il titolo. Tiene due righe al prezzo di una: si
 * capisce il tipo di modifica senza leggere il testo. */
export const TIPI = {
  training_created: { sezione: 'allenamenti', azione: 'Nuovo allenamento' },
  training_changed: { sezione: 'allenamenti', azione: 'Allenamento spostato' },
  training_cancelled: { sezione: 'allenamenti', azione: 'Allenamento annullato' },
  training_recurrence_changed: { sezione: 'allenamenti', azione: 'Programma fisso' },
  absence_announced: { sezione: 'allenamenti', azione: 'Assenza annunciata' },
  next_match_changed: { sezione: 'home', azione: 'Prossima partita' },
  document_uploaded: { sezione: 'anagrafica', azione: 'Documento da verificare' },
  photo_proposed: { sezione: 'anagrafica', azione: 'Fotografia proposta' },
  dato_sensibile: { sezione: 'anagrafica', azione: 'Dato del tesseramento' },
  document_reviewed: { sezione: 'anagrafica', azione: 'Esito del documento' },
  comunicazione: { sezione: 'comunicazioni', azione: 'Comunicazione' }
};

/* Un tipo mai visto non deve produrre una riga rotta.
 *
 * I trigger stanno nel database, e il database si aggiorna per conto suo: un
 * tipo nuovo può arrivare a un'app vecchia. Quando succede si usa la
 * destinazione che la notifica porta già con sé, e una parola generica. */
function classifica(n) {
  const noto = TIPI[n.type];
  if (noto) return noto;
  return { sezione: n.link_tab || 'home', azione: 'Aggiornamento' };
}

/* Quanto tempo fa, detto come lo direbbe una persona.
 *
 * `adesso` si passa da fuori così la funzione è provabile: una funzione che
 * legge l'orologio da sola dà un risultato diverso a ogni esecuzione. */
export function quando(iso, adesso = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((adesso - t) / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return min + ' min fa';
  const ore = Math.floor(min / 60);
  if (ore < 24) return ore === 1 ? "un'ora fa" : ore + ' ore fa';
  const giorni = Math.floor(ore / 24);
  if (giorni === 1) return 'ieri';
  if (giorni < 7) return giorni + ' giorni fa';
  return new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/* Una notifica pronta da mostrare. */
export function descriviNotifica(n, settori, adesso = Date.now()) {
  const c = classifica(n);
  const settore = (settori || []).find(s => s.id === n.sector_id);
  return {
    id: n.id,
    sezione: c.sezione,
    azione: c.azione,
    titolo: n.title || c.azione,
    corpo: n.body || '',
    // Dove porta il tocco. Quella scritta dal database vince: è la sola che
    // sa, per esempio, che un documento verificato va in anagrafica e non
    // nella sezione da cui è partito.
    destinazione: n.link_tab || c.sezione || null,
    settore: settore ? settore.name : '',
    // Le notifiche con un destinatario sono rivolte a una persona sola: il
    // resto del settore non le vede nemmeno.
    personale: !!n.profile_id,
    letta: !!n.read,
    quando: quando(n.created_at, adesso)
  };
}

/* Le proprie azioni non si contano: chi ha creato l'allenamento sa di averlo
   creato, e una pastiglia rossa per il proprio gesto è solo rumore. */
export function daLeggere(notifiche, ioId) {
  return (notifiche || []).filter(n => !n.read && n.actor_id !== ioId).length;
}

/* Raggruppate per giorno.
 *
 * Sessanta righe di seguito sono un muro. Divise in «Oggi», «Ieri» e le date,
 * si scorrono per quello che si cerca — e si vede subito se l'ultima novità è
 * di stamattina o della settimana scorsa.
 *
 * Presuppone l'elenco già in ordine, come arriva dal database (più recenti
 * prima): non riordina, perché riordinare qui vorrebbe dire avere due idee
 * diverse sull'ordine, la sua e quella della query. */
export function raggruppaPerGiorno(notifiche, adesso = Date.now()) {
  const oggi = new Date(adesso);
  oggi.setHours(0, 0, 0, 0);

  const gruppi = [];
  (notifiche || []).forEach(n => {
    const d = new Date(n.created_at);
    let etichetta = 'Prima';
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      const giorni = Math.round((oggi.getTime() - d.getTime()) / 86400000);
      etichetta = giorni <= 0 ? 'Oggi'
        : giorni === 1 ? 'Ieri'
        : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.giorno === etichetta) ultimo.righe.push(n);
    else gruppi.push({ giorno: etichetta, righe: [n] });
  });
  return gruppi;
}
