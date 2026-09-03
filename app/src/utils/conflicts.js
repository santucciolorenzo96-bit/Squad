// Sovrapposizioni di palestra.
//
// Due categorie della stessa società che si presentano nello stesso posto alla
// stessa ora è un problema fisico, non informatico: qualcuno resta fuori. Ma
// l'app non poteva accorgersene, perché ogni schermata lavora sul settore
// attivo e nessuna guardava la giornata della società intera.
//
// IL LUOGO È TESTO LIBERO. "Palestra Comunale", "palestra comunale" e
// " Palestra  Comunale " sono tre stringhe diverse e lo stesso posto. Il
// confronto normalizza, e l'interfaccia propone i luoghi già usati: è il modo
// meno invadente di far convergere le grafie senza costringere nessuno a
// gestire un elenco di impianti.

const DEFAULT_MINUTES = 90;

export function normalizeLocation(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "19:30" -> 1170. Accetta anche "19.30" e "1930", che è come la gente scrive
// di fretta su un telefono.
export function toMinutes(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// L'intervallo occupato. Senza orario di fine si assume un'ora e mezza, che è
// la durata di un allenamento: meglio una stima esplicita che ignorare il
// problema, perché senza fine non ci sarebbe mai nessuna sovrapposizione.
export function occupiedRange(t) {
  const start = toMinutes(t.start_time);
  if (start == null) return null;
  const end = toMinutes(t.end_time);
  return { start, end: end != null && end > start ? end : start + DEFAULT_MINUTES };
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Gli allenamenti che occupano lo stesso posto nello stesso momento.
// `others` sono gli altri allenamenti della società nella stessa data.
export function findLocationConflicts(training, others) {
  const place = normalizeLocation(training.location);
  if (!place) return [];               // senza luogo non c'è niente da confrontare
  const range = occupiedRange(training);
  if (!range) return [];               // senza orario nemmeno

  return others.filter(o => {
    if (o.id && training.id && o.id === training.id) return false;
    if (o.date !== training.date) return false;
    if (normalizeLocation(o.location) !== place) return false;
    const r = occupiedRange(o);
    return r ? overlaps(range, r) : false;
  });
}

// Tutte le sovrapposizioni di un elenco, una volta sola per coppia: senza il
// controllo sull'indice ogni conflitto comparirebbe due volte, una per ciascun
// allenamento coinvolto.
export function findAllConflicts(trainings) {
  const out = [];
  for (let i = 0; i < trainings.length; i++) {
    for (let j = i + 1; j < trainings.length; j++) {
      const a = trainings[i], b = trainings[j];
      if (a.date !== b.date) continue;
      const place = normalizeLocation(a.location);
      if (!place || place !== normalizeLocation(b.location)) continue;
      const ra = occupiedRange(a), rb = occupiedRange(b);
      if (ra && rb && overlaps(ra, rb)) out.push([a, b]);
    }
  }
  return out;
}
