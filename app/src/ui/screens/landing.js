export function renderLanding() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:360px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/logo-default.svg" alt="SQUAD"><div class="brand-name">SQUAD</div></div>
    <div class="card">
      <h2>Bentornato</h2>
      <button class="btn btn-primary" id="goLogin" style="margin-bottom:10px;">Accedi</button>
    </div>
    <div class="card">
      <h2>Nuovo staff</h2>
      <button class="btn btn-secondary" id="goCreateTeam" style="width:100%;margin-bottom:8px;">+ Crea una nuova squadra</button>
      <button class="btn btn-ghost" id="goJoinTeam" style="width:100%;">Entra in una squadra esistente</button>
      <div class="hint" style="margin-top:8px;">Hai un codice invito dal tuo amministratore? Usa "Entra in una squadra esistente".</div>
    </div>
  </div></div>`;

  document.getElementById('goLogin').onclick = async () => {
    const { renderLogin } = await import('./login.js');
    renderLogin();
  };
  document.getElementById('goCreateTeam').onclick = async () => {
    const { renderCreateTeam } = await import('./createTeam.js');
    renderCreateTeam();
  };
  document.getElementById('goJoinTeam').onclick = async () => {
    const { renderJoinTeam } = await import('./joinTeam.js');
    renderJoinTeam();
  };
}
