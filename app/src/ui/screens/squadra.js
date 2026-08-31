import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { toast, confirmModal, formModal, withButtonLoading } from '../modal.js';
import { updateTeam, uploadTeamLogo, regenerateInviteCode } from '../../api/teams.js';
import { createSector, renameSector, removeSector } from '../../api/sectors.js';
import { resizeImageFile, resizeLogoWithTransparency, imageHasAlpha } from '../../utils/image.js';
import { teamInitials } from '../../utils/theme.js';

export function renderSquadraTab(c) {
  c.innerHTML = `
    <div class="settings-col">
    <div class="card">
      <h2>Profilo squadra</h2>
      <div class="logo-upload">
        <div class="logo-preview${state.teamProfile.logo_url ? ' has-logo' : ''}" id="sqLogoPreview">${state.teamProfile.logo_url ? `<img src="${esc(state.teamProfile.logo_url)}">` : esc(teamInitials(state.teamProfile.name))}</div>
        <div style="flex:1;min-width:0;">
          <input type="file" id="sqLogoInput" accept="image/*" class="hidden">
          <button class="file-btn" id="sqLogoBtn">Cambia logo</button>
          <div id="sqLogoTools" class="hidden" style="margin-top:10px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="sqLogoTransparent" style="width:auto;">
              Rendi trasparente lo sfondo
            </label>
            <div class="hint" id="sqLogoHint" style="margin-top:4px;"></div>
          </div>
        </div>
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
      <h2>Dati fiscali</h2>
      <div class="hint" style="margin-top:0;">Compaiono sui documenti amministrativi generati in Documenti: dichiarazione delle quote e modulo d'iscrizione.</div>
      <div class="row2" style="margin-top:12px;">
        <div class="field"><label>Codice fiscale</label><input type="text" id="sqFiscal" value="${esc(state.teamProfile.fiscal_code || '')}"></div>
        <div class="field"><label>Partita IVA</label><input type="text" id="sqVat" value="${esc(state.teamProfile.vat_number || '')}"></div>
      </div>
      <div class="field"><label>Sede legale</label><input type="text" id="sqAddress" placeholder="Via e numero" value="${esc(state.teamProfile.address || '')}"></div>
      <div class="row2">
        <div class="field"><label>CAP</label><input type="text" id="sqZip" value="${esc(state.teamProfile.zip || '')}"></div>
        <div class="field"><label>Provincia</label><input type="text" id="sqProvince" value="${esc(state.teamProfile.province || '')}"></div>
      </div>
      <div class="field"><label>Legale rappresentante</label><input type="text" id="sqLegalRep" value="${esc(state.teamProfile.legal_rep || '')}"></div>
      <div class="field"><label>N. registro attività sportive</label><input type="text" id="sqRegistry" value="${esc(state.teamProfile.registry_number || '')}"></div>
      <div class="row2">
        <div class="field"><label>Email di contatto</label><input type="email" id="sqEmail" value="${esc(state.teamProfile.contact_email || '')}"></div>
        <div class="field"><label>Telefono</label><input type="tel" id="sqPhone" value="${esc(state.teamProfile.contact_phone || '')}"></div>
      </div>
      <div class="error-msg" id="sqFiscalError"></div>
      <button class="btn btn-primary" id="sqSaveFiscal">Salva dati fiscali</button>
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
  let pendingLogoFile = null;
  const tools = document.getElementById('sqLogoTools');
  const cbTransparent = document.getElementById('sqLogoTransparent');
  const logoHint = document.getElementById('sqLogoHint');

  function showPreview(blob) {
    const prev = document.getElementById('sqLogoPreview');
    prev.classList.add('has-logo');
    prev.innerHTML = `<img src="${URL.createObjectURL(blob)}">`;
  }

  // Il logo viene salvato in PNG: il JPEG non ha canale alfa e appiattirebbe
  // la trasparenza su un fondo pieno, disegnando di fatto un riquadro.
  async function buildLogo() {
    if (!pendingLogoFile) return;
    logoHint.textContent = 'Elaborazione…';
    try {
      pendingLogoBlob = cbTransparent.checked
        ? await resizeLogoWithTransparency(pendingLogoFile, 512)
        : await resizeImageFile(pendingLogoFile, 512, { format: 'png' });
      showPreview(pendingLogoBlob);
      logoHint.textContent = cbTransparent.checked
        ? 'Sfondo rimosso a partire dai bordi. Se il risultato non convince, togli la spunta.'
        : '';
    } catch (err) {
      logoHint.textContent = 'Impossibile elaborare l\'immagine.';
    }
  }

  document.getElementById('sqLogoBtn').onclick = () => document.getElementById('sqLogoInput').click();
  document.getElementById('sqLogoInput').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    pendingLogoFile = f;
    tools.classList.remove('hidden');
    const alreadyTransparent = await imageHasAlpha(f).catch(() => false);
    cbTransparent.checked = false;
    cbTransparent.disabled = alreadyTransparent;
    await buildLogo();
    if (alreadyTransparent) logoHint.textContent = 'Il file ha già uno sfondo trasparente.';
  };
  cbTransparent.onchange = buildLogo;
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
  document.getElementById('sqSaveFiscal').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('sqFiscalError');
    const val = id => document.getElementById(id).value.trim() || null;
    try {
      const updated = await updateTeam(state.teamProfile.id, {
        fiscal_code: val('sqFiscal'), vat_number: val('sqVat'), address: val('sqAddress'),
        zip: val('sqZip'), province: val('sqProvince'), legal_rep: val('sqLegalRep'),
        registry_number: val('sqRegistry'), contact_email: val('sqEmail'), contact_phone: val('sqPhone')
      });
      state.teamProfile = updated;
      errEl.textContent = '';
      toast('Dati fiscali salvati');
    } catch (err) {
      errEl.textContent = err.message || 'Errore nel salvataggio.';
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
