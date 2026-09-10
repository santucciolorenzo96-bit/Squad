// Prima schermata dell'app. La gerarchia segue chi la usa davvero: quasi tutti
// gli utenti sono genitori e atleti che accedono a un account già esistente, e
// la seconda azione più frequente è entrare con un codice invito. Registrare
// una società capita una volta sola per club, quindi sta in fondo — visibile,
// non ingombrante.

export function renderLanding() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:380px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>

    <button class="btn btn-primary" id="goLogin" style="width:100%;">Accedi</button>

    <div class="entry-sep"><span>oppure</span></div>

    <button class="entry-card" id="goJoinTeam">
      <div class="entry-ico">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.6" y="5.4" width="14.8" height="9.2" rx="2.4"/><path d="M6 9.2h2.6M6 11.6h4.8"/>
          <circle cx="14.2" cy="10" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <div class="entry-txt">
        <b>Ho un codice invito</b>
        <span>Te l'ha dato la tua società. Bastano un minuto e la tua email.</span>
      </div>
      <span class="entry-arrow">›</span>
    </button>
  </div></div>`;

  document.getElementById('goLogin').onclick = async () => {
    const { renderLogin } = await import('./login.js');
    renderLogin();
  };
  document.getElementById('goJoinTeam').onclick = async () => {
    const { renderJoinTeam } = await import('./joinTeam.js');
    renderJoinTeam();
  };
}
