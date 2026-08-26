import { state } from '../../../state.js';
import { canManageFinance } from '../../../utils/permissions.js';
import { renderFiscalYearsSection } from './fiscalYears.js';
import { renderAccountsSection } from './accounts.js';
import { renderCategoriesSection } from './categories.js';
import { renderCostCentersSection } from './costCenters.js';
import { renderSuppliersSection } from './suppliers.js';
import { renderSponsorsSection } from './sponsors.js';

const SECTIONS = [
  { id: 'conti', label: 'Conti', render: renderAccountsSection },
  { id: 'categorie', label: 'Categorie', render: renderCategoriesSection },
  { id: 'centri', label: 'Centri di costo', render: renderCostCentersSection },
  { id: 'fornitori', label: 'Fornitori', render: renderSuppliersSection },
  { id: 'sponsor', label: 'Sponsor', render: renderSponsorsSection },
  { id: 'esercizi', label: 'Esercizi', render: renderFiscalYearsSection }
];

export function renderFinanzaTab(c) {
  if (!SECTIONS.find(s => s.id === state.financeSubTab)) state.financeSubTab = 'conti';
  const canManage = canManageFinance(state.currentUser);

  c.innerHTML = `
    <div class="sector-switcher" id="financeSubNav" style="margin-bottom:16px;"></div>
    <div id="financeSectionContent"></div>
  `;
  const nav = document.getElementById('financeSubNav');
  SECTIONS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'sector-pill' + (state.financeSubTab === s.id ? ' active' : '');
    b.textContent = s.label;
    b.onclick = () => { state.financeSubTab = s.id; renderFinanzaTab(c); };
    nav.appendChild(b);
  });

  const active = SECTIONS.find(s => s.id === state.financeSubTab);
  active.render(document.getElementById('financeSectionContent'), canManage);
}
