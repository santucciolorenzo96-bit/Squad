/* Sistema di design "carta e inchiostro".
 *
 * Tailwind di serie — slate/indigo, rounded-2xl, shadow-lg, tutto sfumato — è
 * esattamente l'aspetto che si voleva evitare. Quindi qui la scala predefinita
 * non si estende: si SOSTITUISCE. Le classi che producono quell'aspetto
 * (colori generici, angoli molto tondi, ombre morbide) semplicemente non
 * esistono in questo progetto, così non possono rientrare per distrazione.
 *
 * I colori sono variabili CSS e non valori fissi perché il tema chiaro/scuro
 * e l'accento della società li riscrivono a runtime: theme.js continua a
 * funzionare senza sapere niente di Tailwind.
 */
const ink = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./anteprima.html', './src/next/**/*.{js,jsx}'],
  darkMode: ['class', '[data-ink="scuro"]'],
  theme: {
    // Sostituite, non estese.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      carta: ink('--c-carta'),        // il foglio
      carta2: ink('--c-carta2'),      // secondo piano, appena più scuro
      inchiostro: ink('--c-inchiostro'),
      grafite: ink('--c-grafite'),    // testo secondario
      matita: ink('--c-matita'),      // righe e bordi
      timbro: ink('--c-timbro'),      // il rosso del timbro: un accento solo
      verde: ink('--c-verde'),
      ambra: ink('--c-ambra')
    },
    borderRadius: {
      none: '0',
      DEFAULT: '2px',
      sm: '1px',
      lg: '3px',
      full: '9999px'   // resta solo per gli elementi circolari veri (avatar)
    },
    boxShadow: {
      // Ombre dure e spostate, come un blocco di carta appoggiato su un altro.
      // Nessuna sfocatura: la sfocatura è la firma dell'interfaccia generata.
      none: 'none',
      DEFAULT: '3px 3px 0 0 rgb(var(--c-ombra))',
      sm: '2px 2px 0 0 rgb(var(--c-ombra))',
      lg: '5px 5px 0 0 rgb(var(--c-ombra))',
      timbro: '3px 3px 0 0 rgb(var(--c-timbro))'
    },
    fontFamily: {
      // Archivo per l'interfaccia, Newsreader per la voce (titoli di pagina,
      // stati vuoti), Space Mono per tutto ciò che è un numero o un codice.
      // Tre famiglie con un compito ciascuna: è quello che rende un sistema
      // riconoscibile, invece di Inter dappertutto.
      sans: ['Archivo', 'system-ui', 'sans-serif'],
      serif: ['Newsreader', 'Georgia', 'serif'],
      mono: ['"Space Mono"', 'ui-monospace', 'monospace']
    },
    extend: {
      letterSpacing: { etichetta: '0.14em' },
      borderWidth: { 3: '3px' }
    }
  },
  plugins: []
};
