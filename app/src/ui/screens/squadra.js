import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { toast, confirmModal, formModal, withButtonLoading } from '../modal.js';
import { updateTeam, uploadTeamLogo, regenerateInviteCode } from '../../api/teams.js';
import { createSector, renameSector, removeSector } from '../../api/sectors.js';
import { resizeImageFile } from '../../utils/image.js';

export function renderSquadraTab(c) {
  c.innerHTML = `
    <div class="settings-col">
    <div class="card">
      <h2>Profilo squadra</h2>
      <div class="logo-upload">
        <div class="logo-preview" id="sqLogoPreview"><img src="${state.teamProfile.logo_url ? esc(state.teamProfile.logo_url) : '/logo-default.svg'}"></div>
        <div><input type="file" id="sqLogoInput" accept="image/*" class="hidden"><button class="file-btn" id="sqLogoBtn">Cambia logo</button></div>
      </div>
      <div class="field"><label>Nome squadra</label><input type="text" id="sqName" value="${esc(state.teamProfile.name)}"></div>
      <div class="row2">
        <div class="field"><label>Città</label><input type="text" id="sqCity" value="${esc(state.teamProfile.city || '')}"></div>
        <div class="field"><label>Categoria</label><input type="text" id="sqCategory" value="${esc(state.teamProfile.category || '')}"></div>
      </div>
      <div class="error-msg" id="sqError"></div>
      <button class="btn btn-primary" id="sqSave">Salva modifiche</button>
    </div>
    <div class="card">
      <h2>Codice invito</h2>
      <div class="hint">Condividi questo codice con staff e genitori/giocatori: potranno registrarsi da "Entra in una squadra esistente" scegliendo il proprio ruolo.</div>
      <div style="font-family:var(--font-mono);font-size:24px;letter-spacing:0.1em;color:var(--gold);margin:12px 0;text-align:center;">${esc(state.teamProfile.invite_code)}</div>
      <button class="btn btn-secondary" id="sqRegenCode" style="width:100%;">Rigenera codice</button>
    </div>
    <div class="card">
      <h2>Settori</h2>
      <div id="sectorList"></div>
      <button class="btn btn-secondary" id="addSectorBtn" style="width:100%;margin-top:10px;">+ Nuovo settore</button>
    </div>
    </div>
  `;
  let pendingLogoBlob = null;
  document.getElementById('sqLogoBtn').onclick = () => document.getElementById('sqLogoInput').click();
  document.getElementById('sqLogoInput').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    pendingLogoBlob = await resizeImageFile(f, 240);
    document.getElementById('sqLogoPreview').innerHTML = `<img src="${URL.createObjectURL(pendingLogoBlob)}">`;
  };
  document.getElementById('sqSave').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('sqError');
    try {
      let logoUrl = state.teamProfile.logo_url;
      if (pendingLogoBlob) logoUrl = await uploadTeamLogo(state.teamProfile.id, pendingLogoBlob);
      const patch = {
        name: document.getElementById('sqName').value.trim() || state.teamProfile.name,
        city: document.getElementById('sqCity').value.trim(),
        category: document.getElementById('sqCategory').value.trim(),
        logo_url: logoUrl
      };
      const updated = await updateTeam(state.teamProfile.id, patch);
      state.teamProfile = updated;
      toast('Profilo squadra aggiornato');
      const { renderApp } = await import('../layout.js');
      renderApp();
    } catch (e) {
      errEl.textContent = e.message || 'Errore nel salvataggio.';
    }
  });
  document.getElementById('sqRegenCode').onclick = () => {
    confirmModal('Rigenerare il codice invito?', 'Il codice attuale smetterà di funzionare per i nuovi accessi.', async () => {
      const newCode = await regenerateInviteCode();
      state.teamProfile.invite_code = newCode;
      toast('Codice rigenerato');
      renderSquadraTab(c);
    }, 'Rigenera');
  };

  drawSectors();
  document.getElementById('addSectorBtn').onclick = () => {
    formModal('Nuovo settore', `<div class="field"><label>Nome</label><input type="text" id="secName" placeholder="Es. Under 15"></div>`, async () => {
      const name = document.getElementById('secName').value.trim();
      if (!name) return 'Inserisci un nome.';
      const created = await createSector(state.teamProfile.id, name);
      state.sectors.push(created);
      toast('Settore creato');
      const { renderApp } = await import('../layout.js');
      renderApp();
    });
  };
}

function drawSectors() {
  const holder = document.getElementById('sectorList');
  if (!holder) return;
  if (state.sectors.length === 0) { holder.innerHTML = '<div class="hint">Nessun settore creato.</div>'; return; }
  holder.innerHTML = '';
  state.sectors.forEach(s => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<div class="main"><div class="nm">${esc(s.name)}</div></div><button class="icon-btn" data-edit="${s.id}">✎</button><button class="icon-btn danger" data-rm="${s.id}">✕</button>`;
    holder.appendChild(row);
  });
  holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => {
    const sector = state.sectors.find(s => s.id === btn.getAttribute('data-edit'));
    formModal('Rinomina settore', `<div class="field"><label>Nome</label><input type="text" id="secName" value="${esc(sector.name)}"></div>`, async () => {
      const name = document.getElementById('secName').value.trim();
      if (!name) return 'Inserisci un nome.';
      await renameSector(sector.id, name);
      sector.name = name;
      drawSectors();
      const { renderApp } = await import('../layout.js');
      renderApp();
    });
  });
  holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
    const sector = state.sectors.find(s => s.id === btn.getAttribute('data-rm'));
    confirmModal('Eliminare il settore?', `"${sector.name}" verrà eliminato insieme a rosa, partite, classifica e allenamenti collegati a questo settore. Operazione irreversibile.`, async () => {
      await removeSector(sector.id);
      state.sectors = state.sectors.filter(s => s.id !== sector.id);
      if (state.activeSectorId === sector.id) {
        const { switchSector } = await import('../../router.js');
        await switchSector(state.sectors[0] ? state.sectors[0].id : null);
      }
      drawSectors();
      toast('Settore eliminato');
    }, 'Elimina');
  });
}
