import { state } from '../../state.js';
import { DOC_TYPES } from '../permissions.js';
import { BASKET } from './basket.js';
import { CALCIO } from './calcio.js';
import { PALLAVOLO } from './pallavolo.js';

// Registro degli sport. Ogni descrittore dichiara ruoli, campo, statistiche,
// struttura della gara e regole di classifica; le schermate leggono da qui
// invece di sapere cos'è il basket.
//
// L'app è nata cestistica, quindi il basket resta il default ovunque: una
// società senza sport impostato continua a comportarsi esattamente come prima.

export const SPORTS = {
  basket: BASKET,
  calcio: CALCIO,
  pallavolo: PALLAVOLO
};

export const SPORT_LIST = [BASKET, CALCIO, PALLAVOLO];
export const DEFAULT_SPORT = 'basket';

export function getSport(key) {
  return SPORTS[key] || SPORTS[DEFAULT_SPORT];
}

// Lo sport della società attualmente aperta.
export function currentSport() {
  return getSport(state.teamProfile && state.teamProfile.sport);
}

// I tipi di documento con la sigla della federazione giusta: FIP per il
// basket, FIPAV per la pallavolo, FIGC per il calcio. La chiave resta quella
// scritta nel database da sempre — cambiarla per una parola vorrebbe dire
// riscrivere le righe esistenti — quindi cambia solo l'etichetta.
export function tipiDocumento() {
  const sigla = currentSport().federazione || 'FIP';
  return DOC_TYPES.map(t => (
    t.key === 'tesseramento_fip' ? { ...t, label: 'Tesseramento ' + sigla } : t
  ));
}

// La sola sigla, per chi deve comporre una frase invece di un elenco.
export function siglaFederazione() {
  return currentSport().federazione || 'FIP';
}
