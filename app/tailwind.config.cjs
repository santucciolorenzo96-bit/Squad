/* Sistema di design "vetro".
 *
 * Riferimenti: cruscotto scuro blu notte con pannelli traslucidi, e icone a
 * volumi di vetro colorato con una forma sfalsata dietro.
 *
 * La scala predefinita di Tailwind resta sostituita e non estesa, per lo stesso
 * motivo di prima: `slate`, `indigo`, `gray` a disposizione significano che
 * prima o poi qualcuno li usa, e il sistema si sfilaccia. Qui esistono solo i
 * colori che hanno un nome nel progetto.
 *
 * Il vetro ha un difetto noto: traslucenza e sfocatura abbassano il contrasto,
 * ed è il modo in cui questa estetica fallisce. Quindi il testo non vive mai
 * sul vetro puro — i fondi dei pannelli sono abbastanza opachi da tenere il
 * rapporto AA, e la sfocatura ha tre valori soli, definiti qui una volta.
 */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./anteprima.html', './src/next/**/*.{js,jsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#fff',

      fondo: c('--fondo'),          // la notte dietro tutto
      fondo2: c('--fondo2'),
      pannello: c('--pannello'),    // il vetro: si usa con /xx
      bordo: c('--bordo'),

      testo: c('--testo'),
      soffuso: c('--soffuso'),      // testo secondario
      tenue: c('--tenue'),          // testo terziario, mai per informazioni

      // L'accento del prodotto. Uno solo: se ce ne sono due, non ce n'è nessuno.
      blu: c('--blu'),
      blu2: c('--blu2'),            // per la sfumatura del pulsante primario

      // I sei colori delle icone. Non sono decorazione: ogni sezione ne tiene
      // uno per sempre, così l'occhio impara la posizione prima del nome.
      rosa: c('--rosa'),
      verde: c('--verde'),
      corallo: c('--corallo'),
      viola: c('--viola'),
      ambra: c('--ambra'),
      ciano: c('--ciano'),

      // Stato. Verde e ambra sono condivisi con le icone di proposito: sono
      // pochi colori usati bene, non una tavolozza che cresce.
      rosso: c('--rosso')
    },
    borderRadius: {
      none: '0',
      sm: '8px',
      DEFAULT: '12px',
      lg: '16px',
      xl: '20px',
      '2xl': '26px',
      full: '9999px'
    },
    // Tre valori. Sfocare "quanto sembra giusto" scheda per scheda è il modo
    // in cui un'interfaccia di vetro diventa una poltiglia.
    backdropBlur: {
      none: '0',
      sm: '10px',
      DEFAULT: '18px',
      lg: '30px'
    },
    boxShadow: {
      none: 'none',
      // Profondità: ombra scura ampia (l'oggetto è sopra il fondo) più un filo
      // di luce interno sul bordo alto (l'oggetto è illuminato da sopra).
      // La sorgente di luce è la stessa ovunque, altrimenti il rilievo è finto.
      sm: '0 2px 8px -2px rgb(0 0 0 / 0.35), inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      DEFAULT: '0 8px 24px -6px rgb(0 0 0 / 0.45), inset 0 1px 0 0 rgb(255 255 255 / 0.07)',
      lg: '0 20px 48px -12px rgb(0 0 0 / 0.55), inset 0 1px 0 0 rgb(255 255 255 / 0.09)',
      blu: '0 8px 26px -6px rgb(var(--blu) / 0.45)'
    },
    fontFamily: {
      sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
    },
    extend: {
      letterSpacing: { etichetta: '0.1em' },
      keyframes: {
        salita: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' }
        }
      },
      animation: { salita: 'salita .35s cubic-bezier(.22,1,.36,1) both' }
    }
  },
  plugins: []
};
