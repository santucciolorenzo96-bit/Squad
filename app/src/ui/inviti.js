import { state } from '../state.js';
import { esc } from '../utils/format.js';
import { formModal, confirmModal, toast, showLoadError } from './modal.js';
import { fetchInvites, createInvite, revokeInvite } from '../api/invites.js';
import { ROLES, ASSIGNABLE_ROLES, LINKED_ROLES } from '../utils/permissions.js';
import { orderedSectors } from '../utils/sectors.js';

// Inviti nominativi.
//
// Il codice società fa entrare chiunque, e chi entra sceglie da sé chi dice di
// essere: può solo dichiararsi atleta, genitore, scout o staff. Poi qualcuno
// deve promuoverlo, assegnargli le categorie e collegarlo alla scheda giusta.
// Tre passaggi manuali per persona, ognuno dimenticabile — e finché non li fai
// la persona è dentro ma non vede niente.
//
// Un invito porta con sé quelle tre decisioni, prese prima. Chi lo usa entra
// già a posto.

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// Un invito è o usato, o revocato, o scaduto, o valido — in quest'ordine:
// un invito già usato che nel frattempo è scaduto resta "usato", perché è
// quello che è successo davvero.
function statoInvito(inv) {
  if (inv.used_at) return { key: 'usato', label: 'Usato', cls: 'ok' };
  if (inv.revoked_at) return { key: 'revocato', label: 'Revocato', cls: 'rejected' };
  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) return { key: 'scaduto', label: 'Scaduto', cls: 'rejected' };
  return { key: 'valido', label: 'Valido', cls: 'pending' };
}

export function renderInviti(holder) {
  drawInviti(holder);
}

async function drawInviti(holder) {
  holder.innerHTML = '<div class="skeleton skeleton-row"></div>';
  let inviti;
  try {
    inviti = await fetchInvites();
  } catch (e) {
    showLoadError(holder, e, 'gli inviti');
    return;
  }

  // Quelli ancora spendibili in cima: gli altri sono storia, e la storia si
  // consulta, non si sorveglia.
  const attivi = inviti.filter(i => statoInvito(i).key === 'valido');
  const chiusi = inviti.filter(i => statoInvito(i).key !== 'valido');

  holder.innerHTML = `
    <button class="btn btn-secondary" id="newInviteBtn" style="width:100%;">+ Invita una persona</button>
    <div class="hint">Il codice porta con sé ruolo, categorie e — per genitori e atleti — la scheda a cui collegarsi. Vale una volta sola e scade.</div>
    <div id="invitiAttivi"></div>
    ${chiusi.length ? `<button class="btn btn-ghost" id="storicoBtn" style="width:100%;margin-top:10px;">Inviti passati (${chiusi.length})</button>
    <div id="invitiChiusi" style="display:none;"></div>` : ''}
  `;

  const boxA = document.getElementById('invitiAttivi');
  if (attivi.length === 0) {
    boxA.innerHTML = '<div class="hint" style="margin-top:10px;">Nessun invito in attesa.</div>';
  } else {
    boxA.innerHTML = attivi.map(rigaInvito).join('');
  }

  const storicoBtn = document.getElementById('storicoBtn');
  if (storicoBtn) {
    const boxC = document.getElementById('invitiChiusi');
    boxC.innerHTML = chiusi.map(rigaInvito).join('');
    storicoBtn.onclick = () => {
      const aperto = boxC.style.display !== 'none';
      boxC.style.display = aperto ? 'none' : '';
      storicoBtn.textContent = (aperto ? 'Inviti passati' : 'Nascondi gli inviti passati') + ` (${chiusi.length})`;
    };
  }

  document.getElementById('newInviteBtn').onclick = () => openInviteModal(holder);

  holder.querySelectorAll('[data-copy]').forEach(btn => btn.onclick = async (e) => {
    e.stopPropagation();
    const code = btn.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(code);
      toast('Codice copiato');
    } catch (err) {
      // Senza permesso per gli appunti il codice è comunque scritto lì accanto:
      // dirlo è più utile che far finta di niente.
      toast('Copialo a mano: ' + code);
    }
  });

  holder.querySelectorAll('[data-revoke]').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    const inv = inviti.find(i => i.id === btn.getAttribute('data-revoke'));
    confirmModal('Revocare l\'invito?',
      `Il codice ${inv.code} smetterà di funzionare. Chi l'ha ricevuto non potrà più usarlo.`,
      async () => {
        await revokeInvite(inv.id);
        toast('Invito revocato');
        drawInviti(holder);
      }, 'Revoca');
  });
}

function rigaInvito(inv) {
  const st = statoInvito(inv);
  const nomiSettori = (inv.sector_ids || [])
    .map(id => (state.sectors.find(s => s.id === id) || {}).name).filter(Boolean);
  return `
    <div class="card" style="margin-top:10px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${esc(inv.label || ROLES[inv.role] || inv.role)}</div>
          <div class="hint">
            ${esc(ROLES[inv.role] || inv.role)}${nomiSettori.length ? ' · ' + esc(nomiSettori.join(', ')) : ''}
            ${inv.players ? ' · collegato a ' + esc(inv.players.name) : ''}
          </div>
        </div>
        <span class="status-badge ${st.cls}">${st.label}</span>
      </div>
      ${st.key === 'valido' ? `
      <div class="invite-code-row">
        <code class="invite-code">${esc(inv.code)}</code>
        <button class="btn btn-ghost" data-copy="${esc(inv.code)}">Copia</button>
        <button class="icon-btn danger" data-revoke="${inv.id}" title="Revoca">✕</button>
      </div>
      <div class="hint">${inv.expires_at ? 'Scade il ' + fmtDate(inv.expires_at) : 'Senza scadenza'}</div>
      ` : `<div class="hint" style="margin-top:6px;">
        ${inv.used_at ? 'Usato il ' + fmtDate(inv.used_at) + (inv.profiles ? ' da ' + esc(inv.profiles.display_name) : '')
          : inv.revoked_at ? 'Revocato il ' + fmtDate(inv.revoked_at)
          : 'Scaduto il ' + fmtDate(inv.expires_at)}
      </div>`}
      ${inv.note ? `<div class="hint">${esc(inv.note)}</div>` : ''}
    </div>`;
}

function openInviteModal(holder) {
  const settori = orderedSectors(state.sectors);
  // La rosa della categoria aperta: un genitore si invita quasi sempre mentre si
  // sta guardando la squadra del figlio. Per una categoria diversa si cambia
  // categoria e si torna qui.
  const giocatori = state.roster.slice().sort((a, b) => a.name.localeCompare(b.name));

  formModal('Invita una persona', `
    <div class="field"><label>Ruolo</label>
      <select id="ivRole">
        ${ASSIGNABLE_ROLES.map(r => `<option value="${r}"${r === 'allenatore' ? ' selected' : ''}>${ROLES[r]}</option>`).join('')}
      </select>
      <div class="hint">Entrerà già con questo ruolo: nessuna promozione da fare dopo.</div>
    </div>
    <div class="field"><label>Nome della persona <span class="hint" style="display:inline;">(per ricordarti a chi l'hai mandato)</span></label>
      <input type="text" id="ivLabel" placeholder="Es. Marco Bianchi">
    </div>
    <div class="field" id="ivPlayerWrap" style="display:none;">
      <label>Collega alla scheda di</label>
      <select id="ivPlayer">
        <option value="">— nessuna, la collego dopo —</option>
        ${giocatori.map(p => `<option value="${p.id}">${esc(p.name)} · #${esc(p.number)}</option>`).join('')}
      </select>
      <div class="hint">Vedrà subito convocazioni, quote e documenti di questo atleta.</div>
    </div>
    <div class="field" id="ivSectorWrap">
      <label>Categorie</label>
      ${settori.length
        ? settori.map(s => `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;${s.parent_id ? 'padding-left:18px;' : ''}">
            <input type="checkbox" data-sec="${s.id}" style="width:auto;"> ${esc(s.name)}</label>`).join('')
        : '<div class="hint">Nessuna categoria creata: creane una da Squadra.</div>'}
      <div class="hint">Senza categorie assegnate entra ma non vede nessuna rosa.</div>
    </div>
    <div class="field"><label>Validità</label>
      <select id="ivDays">
        <option value="7">7 giorni</option>
        <option value="14" selected>14 giorni</option>
        <option value="30">30 giorni</option>
      </select>
    </div>
  `, async () => {
    const role = document.getElementById('ivRole').value;
    const playerEl = document.getElementById('ivPlayer');
    const playerId = LINKED_ROLES.includes(role) ? (playerEl.value || null) : null;
    const sectorIds = Array.from(document.querySelectorAll('#ivSectorWrap [data-sec]:checked'))
      .map(el => el.getAttribute('data-sec'));

    const inv = await createInvite({
      role,
      playerId,
      sectorIds,
      label: document.getElementById('ivLabel').value.trim() || null,
      daysValid: parseInt(document.getElementById('ivDays').value, 10)
    });
    toast('Invito creato: ' + inv.code);
    drawInviti(holder);
  }, { confirmLabel: 'Crea invito' });

  // Il collegamento a una scheda ha senso solo per chi la scheda ce l'ha:
  // proporlo a un allenatore sarebbe un campo da ignorare ogni volta.
  const roleEl = document.getElementById('ivRole');
  const aggiorna = () => {
    const linked = LINKED_ROLES.includes(roleEl.value);
    document.getElementById('ivPlayerWrap').style.display = linked ? '' : 'none';
    document.getElementById('ivSectorWrap').style.display = linked ? 'none' : '';
  };
  roleEl.onchange = aggiorna;
  aggiorna();
}
