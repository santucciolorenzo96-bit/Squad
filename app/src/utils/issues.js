// Rilevamento dei problemi della società: funzioni pure, nessun DOM e nessuna
// query. Ricevono i dati già caricati e restituiscono un elenco di anomalie.
//
// È volutamente deterministico e calcolato qui nel browser: un certificato
// scaduto è scaduto, non "forse". Nessun servizio esterno, nessun costo.

import { findAllConflicts } from './conflicts.js';

export const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };
export const SEVERITY_LABEL = { critical: 'Da risolvere', warning: 'Da seguire', info: 'Da sistemare' };

const DAY = 86400000;

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

// Il documento che "vale" oggi per un giocatore e un tipo: fra quelli non
// respinti, quello con la scadenza più lontana (o, se nessuno ha scadenza, il
// più recente). Un certificato vecchio e scaduto non è un problema se ne
// esiste uno nuovo valido.
function effectiveDocument(docs) {
  const usable = docs.filter(d => d.status !== 'rejected');
  if (usable.length === 0) return null;
  const withExpiry = usable.filter(d => d.expires_at);
  if (withExpiry.length > 0) {
    return withExpiry.reduce((best, d) => (d.expires_at > best.expires_at ? d : best));
  }
  return usable.reduce((best, d) => ((d.uploaded_at || '') > (best.uploaded_at || '') ? d : best));
}

export function detectIssues(ctx) {
  const {
    today, players = [], documents = [], deadlines = [], communications = [],
    trainings = [], attendance = [], sponsors = [], sectors = [], hasFinance = false
  } = ctx;

  const issues = [];
  const sectorName = (id) => (sectors.find(s => s.id === id) || {}).name || 'Settore';
  const playerById = {};
  players.forEach(p => { playerById[p.id] = p; });

  // Solo chi è effettivamente inserito in una categoria: un giocatore senza
  // settore è un'anagrafica in sospeso, non un tesserato scoperto.
  const rostered = players.filter(p => (p.player_sectors || []).length > 0);

  const docsByPlayer = {};
  documents.forEach(d => {
    if (!docsByPlayer[d.player_id]) docsByPlayer[d.player_id] = [];
    docsByPlayer[d.player_id].push(d);
  });

  const playerLabel = (p) => '#' + p.number + ' ' + p.name;
  const playerSub = (p) => (p.player_sectors || []).map(ps => sectorName(ps.sector_id)).join(', ');

  // --- Certificati medici -------------------------------------------------
  const missing = [], expired = [], expiring = [];
  rostered.forEach(p => {
    const certs = (docsByPlayer[p.id] || []).filter(d => d.doc_type === 'certificato_medico');
    const eff = effectiveDocument(certs);
    if (!eff) {
      missing.push({ label: playerLabel(p), sub: playerSub(p) || 'Nessun certificato caricato', player: p });
      return;
    }
    if (!eff.expires_at) return; // caricato senza scadenza: non è deducibile
    const left = daysBetween(today, eff.expires_at);
    if (left == null) return;
    if (left < 0) {
      expired.push({
        label: playerLabel(p),
        sub: 'Scaduto il ' + fmtDate(eff.expires_at) + ' · ' + (-left) + ' ' + plural(-left, 'giorno', 'giorni') + ' fa',
        player: p, sort: left
      });
    } else if (left <= 30) {
      expiring.push({
        label: playerLabel(p),
        sub: 'Scade il ' + fmtDate(eff.expires_at) + ' · fra ' + left + ' ' + plural(left, 'giorno', 'giorni'),
        player: p, sort: left
      });
    }
  });

  if (expired.length) issues.push({
    id: 'certificati_scaduti', severity: 'critical',
    title: 'Certificati medici scaduti',
    summary: expired.length + ' ' + plural(expired.length, 'atleta non può', 'atleti non possono')
      + ' scendere in campo finché il certificato non viene rinnovato.',
    items: expired.sort((a, b) => a.sort - b.sort),
    action: { label: 'Apri Anagrafica', tab: 'anagrafica' }
  });

  if (missing.length) issues.push({
    id: 'certificati_mancanti', severity: 'critical',
    title: 'Certificati medici mancanti',
    summary: missing.length + ' ' + plural(missing.length, 'atleta in rosa non ha', 'atleti in rosa non hanno')
      + ' nessun certificato agonistico caricato.',
    items: missing,
    action: { label: 'Apri Anagrafica', tab: 'anagrafica' }
  });

  if (expiring.length) issues.push({
    id: 'certificati_in_scadenza', severity: 'warning',
    title: 'Certificati medici in scadenza',
    summary: expiring.length + ' ' + plural(expiring.length, 'certificato scade', 'certificati scadono')
      + ' entro 30 giorni: conviene avvisare adesso.',
    items: expiring.sort((a, b) => a.sort - b.sort),
    action: { label: 'Apri Anagrafica', tab: 'anagrafica' }
  });

  const toReview = documents.filter(d => d.status === 'in_review');
  if (toReview.length) issues.push({
    id: 'documenti_da_approvare', severity: 'info',
    title: 'Documenti in attesa di approvazione',
    summary: toReview.length + ' ' + plural(toReview.length, 'documento caricato aspetta', 'documenti caricati aspettano')
      + ' una verifica.',
    items: toReview.map(d => {
      const p = playerById[d.player_id];
      return {
        label: p ? playerLabel(p) : 'Atleta',
        sub: (d.doc_type === 'certificato_medico' ? 'Certificato medico' : 'Tesseramento FIP')
          + ' · caricato il ' + fmtDate((d.uploaded_at || '').slice(0, 10))
      };
    }),
    action: { label: 'Apri Anagrafica', tab: 'anagrafica' }
  });

  // --- Scadenze economiche ------------------------------------------------
  if (hasFinance) {
    const overdueIncome = [], soonIncome = [], overdueExpense = [];
    deadlines.forEach(e => {
      const left = daysBetween(today, e.due_date);
      if (left == null) return;
      const p = e.player_id ? playerById[e.player_id] : null;
      const who = p ? playerLabel(p) : (e.party_name || e.description);
      const residual = e._status ? Number(e._status.residual_amount) : Number(e.planned_amount);
      const row = {
        label: who,
        sub: e.description + ' · ' + fmtMoney(residual) + ' · scadenza ' + fmtDate(e.due_date),
        player: p, sort: left
      };
      if (e.kind === 'income') {
        if (left < 0) overdueIncome.push(row);
        else if (left <= 15) soonIncome.push(row);
      } else if (left < 0) {
        overdueExpense.push(row);
      }
    });

    if (overdueIncome.length) issues.push({
      id: 'quote_scadute', severity: 'warning',
      title: 'Quote scadute non incassate',
      summary: overdueIncome.length + ' ' + plural(overdueIncome.length, 'scadenza è', 'scadenze sono')
        + ' oltre la data prevista.',
      items: overdueIncome.sort((a, b) => a.sort - b.sort),
      action: { label: 'Apri Finanza', tab: 'finanza' }
    });

    if (soonIncome.length) issues.push({
      id: 'quote_in_scadenza', severity: 'info',
      title: 'Quote in scadenza',
      summary: soonIncome.length + ' ' + plural(soonIncome.length, 'scadenza', 'scadenze') + ' entro 15 giorni.',
      items: soonIncome.sort((a, b) => a.sort - b.sort),
      action: { label: 'Apri Finanza', tab: 'finanza' }
    });

    if (overdueExpense.length) issues.push({
      id: 'uscite_scadute', severity: 'warning',
      title: 'Uscite scadute non pagate',
      summary: overdueExpense.length + ' ' + plural(overdueExpense.length, 'pagamento è', 'pagamenti sono')
        + ' oltre la scadenza.',
      items: overdueExpense.sort((a, b) => a.sort - b.sort),
      action: { label: 'Apri Finanza', tab: 'finanza' }
    });

    const sponsorSoon = sponsors.filter(s => {
      if (!s.active || !s.contract_end) return false;
      const left = daysBetween(today, s.contract_end);
      return left != null && left <= 60;
    }).map(s => {
      const left = daysBetween(today, s.contract_end);
      return {
        label: s.name,
        sub: left < 0
          ? 'Contratto scaduto il ' + fmtDate(s.contract_end)
          : 'Contratto in scadenza il ' + fmtDate(s.contract_end) + ' · fra ' + left + ' ' + plural(left, 'giorno', 'giorni'),
        sort: left
      };
    });
    if (sponsorSoon.length) issues.push({
      id: 'sponsor_in_scadenza', severity: 'warning',
      title: 'Contratti sponsor da rinnovare',
      summary: sponsorSoon.length + ' ' + plural(sponsorSoon.length, 'contratto scade o è scaduto', 'contratti scadono o sono scaduti')
        + ' entro 60 giorni.',
      items: sponsorSoon.sort((a, b) => a.sort - b.sort),
      action: { label: 'Apri Finanza', tab: 'finanza' }
    });
  }

  // --- Comunicazioni ------------------------------------------------------
  const pendingComms = [];
  communications.forEach(comm => {
    if (!comm.requires_response) return;
    if (comm.event_date && comm.event_date < today) return; // evento ormai passato
    const recipients = comm.communication_recipients || [];
    const pending = recipients.filter(r => r.status === 'pending');
    if (pending.length === 0) return;
    const left = comm.event_date ? daysBetween(today, comm.event_date) : null;
    let when = '';
    if (left != null) when = ' · ' + (left === 0 ? 'oggi' : (left === 1 ? 'domani' : 'fra ' + left + ' giorni'));
    pendingComms.push({
      label: comm.title,
      sub: sectorName(comm.sector_id) + ' · ' + pending.length + ' su ' + recipients.length + ' senza risposta' + when,
      sort: left == null ? 999 : left,
      urgent: left != null && left <= 2,
      contacts: pending.map(r => playerById[r.player_id]).filter(Boolean)
    });
  });
  if (pendingComms.length) {
    const urgent = pendingComms.some(c => c.urgent);
    issues.push({
      id: 'convocazioni_senza_risposta', severity: urgent ? 'critical' : 'warning',
      title: 'Convocazioni senza conferma',
      summary: urgent
        ? 'Un evento è imminente e non tutti hanno confermato: servono i numeri adesso.'
        : pendingComms.length + ' ' + plural(pendingComms.length, 'comunicazione aspetta', 'comunicazioni aspettano') + ' ancora delle conferme.',
      items: pendingComms.sort((a, b) => a.sort - b.sort),
      action: { label: 'Apri Comunicazioni', tab: 'comunicazioni' }
    });
  }

  // --- Palestra occupata da due categorie ---------------------------------
  // Nessuna schermata poteva accorgersene: ognuna lavora sul settore attivo, e
  // un conflitto per definizione sta fra settori diversi. Solo quelli futuri:
  // su una sovrapposizione di ieri non c'e' piu' niente da decidere.
  const futuri = trainings.filter(t => t.date >= today);
  const scontri = findAllConflicts(futuri).map(([a, b]) => ({
    label: ((a.sectors && a.sectors.name) || sectorName(a.sector_id))
      + ' e ' + ((b.sectors && b.sectors.name) || sectorName(b.sector_id)),
    sub: fmtDate(a.date) + ' · ' + (a.location || '')
      + ' · ' + (a.start_time || '') + (a.end_time ? '-' + a.end_time : '')
      + ' e ' + (b.start_time || '') + (b.end_time ? '-' + b.end_time : ''),
    sort: a.date
  }));
  if (scontri.length) issues.push({
    id: 'palestra_occupata', severity: 'warning',
    title: 'Due categorie nello stesso posto',
    summary: scontri.length + ' ' + plural(scontri.length, 'sovrapposizione', 'sovrapposizioni')
      + ' di palestra fra categorie diverse: qualcuno rischia di restare fuori.',
    items: scontri.sort((x, y) => x.sort.localeCompare(y.sort)),
    action: { label: 'Apri Allenamenti', tab: 'allenamenti' }
  });

  // --- Presenze non rilevate ---------------------------------------------
  const tracked = new Set(attendance.map(a => a.training_id));
  const untracked = trainings
    .filter(t => t.date <= today && !tracked.has(t.id))
    .map(t => ({
      label: ((t.sectors && t.sectors.name) || sectorName(t.sector_id)) + ' · ' + fmtDate(t.date),
      sub: t.title + (t.start_time ? ' · ' + t.start_time : ''),
      sort: t.date
    }));
  if (untracked.length) issues.push({
    id: 'presenze_non_rilevate', severity: 'info',
    title: 'Presenze non rilevate',
    summary: untracked.length + ' ' + plural(untracked.length, 'allenamento svolto non ha', 'allenamenti svolti non hanno')
      + ' nessuna presenza registrata nelle ultime 3 settimane.',
    items: untracked.sort((a, b) => b.sort.localeCompare(a.sort)),
    action: { label: 'Apri Allenamenti', tab: 'allenamenti' }
  });

  return issues.sort((a, b) =>
    (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (b.items.length - a.items.length));
}
