import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { toast, confirmModal } from '../modal.js';
import { updateTeam, uploadTeamLogo, regenerateInviteCode } from '../../api/teams.js';
import { resizeImageFile } from '../../utils/image.js';
import { applyTheme } from '../../utils/theme.js';

export function renderSquadraTab(c) {
  c.innerHTML = `
    <div class="card">
      <h2>Profilo squadra</h2>
      <div class="logo-upload">
        <div class="logo-preview" id="sqLogoPreview">${state.teamProfile.logo_url ? `<img src="${esc(state.teamProfile.logo_url)}">` : '🏀'}</div>
        <div><input type="file" id="sqLogoInput" accept="image/*" class="hidden"><button class="file-btn" id="sqLogoBtn">Cambia logo</button></div>
      </div>
      <div class="field"><label>Nome squadra</label><input type="text" id="sqName" value="${esc(state.teamProfile.name)}"></div>
      <div class="row2">
        <div class="field"><label>Città</label><input type="text" id="sqCity" value="${esc(state.teamProfile.city || '')}"></div>
        <div class="field"><label>Categoria</label><input type="text" id="sqCategory" value="${esc(state.teamProfile.category || '')}"></div>
      </div>
      <div class="field">
        <label>Colori squadra</label>
        <div class="color-swatch-row">
          <div class="color-field"><input type="color" id="sqPrimary" value="${state.teamProfile.primary_color || '#FF6A13'}"><span>Primario</span></div>
          <div class="color-field"><input type="color" id="sqSecondary" value="${state.teamProfile.secondary_color || '#FFC53D'}"><span>Secondario</span></div>
          <div class="hint" style="margin-top:0;">Personalizza con i colori sociali della squadra. Il default è arancione/nero.</div>
        </div>
      </div>
      <div class="error-msg" id="sqError"></div>
      <button class="btn btn-primary" id="sqSave">Salva modifiche</button>
    </div>
    <div class="card">
      <h2>Codice invito staff</h2>
      <div class="hint">Condividi questo codice con allenatori/segnapunti: potranno registrarsi da "Entra in una squadra esistente" e tu potrai poi assegnare il ruolo da Utenti.</div>
      <div style="font-family:var(--font-mono);font-size:24px;letter-spacing:0.1em;color:var(--gold);margin:12px 0;text-align:center;">${esc(state.teamProfile.invite_code)}</div>
      <button class="btn btn-secondary" id="sqRegenCode" style="width:100%;">Rigenera codice</button>
    </div>
  `;
  let pendingLogoBlob = null;
  document.getElementById('sqLogoBtn').onclick = () => document.getElementById('sqLogoInput').click();
  document.getElementById('sqLogoInput').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    pendingLogoBlob = await resizeImageFile(f, 240);
    document.getElementById('sqLogoPreview').innerHTML = `<img src="${URL.createObjectURL(pendingLogoBlob)}">`;
  };
  document.getElementById('sqSave').onclick = async () => {
    const errEl = document.getElementById('sqError');
    try {
      let logoUrl = state.teamProfile.logo_url;
      if (pendingLogoBlob) logoUrl = await uploadTeamLogo(state.teamProfile.id, pendingLogoBlob);
      const patch = {
        name: document.getElementById('sqName').value.trim() || state.teamProfile.name,
        city: document.getElementById('sqCity').value.trim(),
        category: document.getElementById('sqCategory').value.trim(),
        logo_url: logoUrl,
        primary_color: document.getElementById('sqPrimary').value,
        secondary_color: document.getElementById('sqSecondary').value
      };
      const updated = await updateTeam(state.teamProfile.id, patch);
      state.teamProfile = updated;
      applyTheme(updated);
      toast('Profilo squadra aggiornato');
      const { renderApp } = await import('../layout.js');
      renderApp();
    } catch (e) {
      errEl.textContent = e.message || 'Errore nel salvataggio.';
    }
  };
  document.getElementById('sqRegenCode').onclick = () => {
    confirmModal('Rigenerare il codice invito?', 'Il codice attuale smetterà di funzionare per i nuovi accessi.', async () => {
      const newCode = await regenerateInviteCode();
      state.teamProfile.invite_code = newCode;
      toast('Codice rigenerato');
      renderSquadraTab(c);
    }, 'Rigenera');
  };
}
