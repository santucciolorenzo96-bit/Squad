import { state } from '../../state.js';
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
