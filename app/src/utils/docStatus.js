// Stato di un adempimento per un singolo atleta.
//
// Vive qui e non dentro la schermata perché la stessa domanda — "questo
// certificato è a posto?" — viene fatta dalla tabella dell'anagrafica, dai
// riquadri di riepilogo e da Situazione, e due risposte diverse alla stessa
// domanda sono peggio di nessuna risposta.

export const DOC_STATE = {
  ok: { label: 'Valido', tone: 'ok', rank: 0 },
  scadenza: { label: 'In scadenza', tone: 'warn', rank: 1 },
  verifica: { label: 'In verifica', tone: 'warn', rank: 2 },
  scaduto: { label: 'Scaduto', tone: 'bad', rank: 3 },
  respinto: { label: 'Respinto', tone: 'bad', rank: 4 },
  mancante: { label: 'Mancante', tone: 'bad', rank: 5 }
};

export const EXPIRING_DAYS = 30;

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Fra più copie dello stesso documento vale quella che copre più a lungo: un
// certificato vecchio e scaduto non è un problema se accanto ce n'è uno nuovo.
// A parità di scadenza vince il caricamento più recente, che è la correzione
// di quello prima.
function best(docs) {
  return docs.slice().sort((a, b) => {
    const ea = a.expires_at || '', eb = b.expires_at || '';
    if (ea !== eb) return eb.localeCompare(ea);
    return String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || ''));
  })[0] || null;
}

// `docs` sono i documenti di quel tipo per quell'atleta, in qualunque ordine.
export function docStatus(docs, today) {
  const list = (docs || []);
  if (list.length === 0) return 'mancante';

  const approvati = list.filter(d => d.status === 'approved');
  if (approvati.length) {
    const d = best(approvati);
    if (!d.expires_at) return 'ok';                 // documento senza scadenza
    if (d.expires_at < today) return 'scaduto';
    return daysBetween(today, d.expires_at) <= EXPIRING_DAYS ? 'scadenza' : 'ok';
  }

  // Un documento in verifica non è ancora una copertura, ma non è nemmeno
  // colpa di chi l'ha caricato: la palla è alla società.
  if (list.some(d => d.status === 'in_review')) return 'verifica';
  if (list.some(d => d.status === 'rejected')) return 'respinto';
  return 'mancante';
}

// Lo stato peggiore fra più adempimenti: è quello che decide il colore della
// riga, perché è quello che impedisce all'atleta di scendere in campo.
export function worstStatus(states) {
  let worst = 'ok';
  (states || []).forEach(s => {
    if (DOC_STATE[s] && DOC_STATE[s].rank > DOC_STATE[worst].rank) worst = s;
  });
  return worst;
}

// Anni compiuti. Serve a raggruppare per annata, quindi conta il compleanno,
// non la differenza fra gli anni.
export function ageFrom(birthDate, today) {
  if (!birthDate) return null;
  const b = new Date(birthDate + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  if (isNaN(b)) return null;
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
}
