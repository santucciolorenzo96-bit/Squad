import React from 'react';

/* LA RETE DI SICUREZZA.
 *
 * Fino a oggi l'app non aveva un error boundary. Vuol dire che qualunque
 * eccezione dentro un componente — una riga che legge una proprietà di null,
 * un dato arrivato in una forma che non si aspettava — faceva smontare a React
 * tutto l'albero e lasciava lo SCHERMO BIANCO. Nessun messaggio, nessun
 * appiglio, niente da raccontare a chi deve poi capire cosa è successo.
 *
 * È esattamente quello che ha visto chi stava segnando un'amichevole: «dopo
 * cinque minuti è crashato». Non c'era nessun crash del browser: c'era
 * un'eccezione, e l'app scompariva.
 *
 * Durante una partita è il peggiore dei comportamenti possibili, perché la
 * partita continua mentre lo scout non c'è più. E il difetto non lo si trova
 * mai, perché di un errore senza messaggio non resta traccia.
 *
 * Quindi qui si fanno tre cose, in quest'ordine di importanza:
 *
 * 1. NON SI PERDE IL LAVORO. La partita è già scritta in `localStorage` a ogni
 *    tocco: la rete non deve salvarla, deve solo dirlo — e offrire di
 *    riprovare senza ricaricare, perché ricaricare in palestra senza rete è la
 *    cosa che spaventa di più.
 *
 * 2. SI VEDE COSA È SUCCESSO. Il messaggio e le prime righe dello stack stanno
 *    a schermo, in chiaro, con un pulsante che li copia. Chi segna non li
 *    capirà, ma li può incollare in un messaggio, e quello basta.
 *
 * 3. RESTA SCRITTO. L'errore finisce in `localStorage` con l'ora: sopravvive al
 *    ricaricamento, e il giorno dopo si può ancora leggere cosa è andato
 *    storto. Ne teniamo gli ultimi cinque.
 */

const CHIAVE = 'squad.errori';

export function scriviErrore(errore, dove, info) {
  const voce = {
    quando: new Date().toISOString(),
    dove: dove || 'app',
    messaggio: (errore && errore.message) || String(errore),
    stack: ((errore && errore.stack) || '').split('\n').slice(0, 12).join('\n'),
    componenti: ((info && info.componentStack) || '').split('\n').slice(0, 12).join('\n'),
    indirizzo: (typeof location !== 'undefined' && location.pathname) || '',
    schermo: typeof window !== 'undefined' ? window.innerWidth + 'x' + window.innerHeight : ''
  };
  try {
    const prima = JSON.parse(window.localStorage.getItem(CHIAVE) || '[]');
    const dopo = [voce].concat(Array.isArray(prima) ? prima : []).slice(0, 5);
    window.localStorage.setItem(CHIAVE, JSON.stringify(dopo));
  } catch (e) {
    // Se non si può scrivere nemmeno questo, pazienza: il messaggio a schermo
    // c'è comunque, ed è quello che serve adesso.
  }
  return voce;
}

export function leggiErrori() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHIAVE) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

export function scordaErrori() {
  try { window.localStorage.removeItem(CHIAVE); } catch (e) { /* niente */ }
}

/* Anche fuori da React si può crollare: una promessa rifiutata senza `catch`,
 * un listener che lancia. Lì l'albero non si smonta e lo schermo resta, ma
 * l'errore sparisce dalla console appena si chiude la scheda. Si annota. */
export function ascoltaErroriSparsi() {
  if (typeof window === 'undefined' || window.__squadAscolta) return;
  window.__squadAscolta = true;
  window.addEventListener('error', (e) => {
    if (e && e.error) scriviErrore(e.error, 'fuori da React');
  });
  window.addEventListener('unhandledrejection', (e) => {
    scriviErrore((e && e.reason) || new Error('promessa rifiutata'), 'promessa');
  });
}

export class Rete extends React.Component {
  constructor(props) {
    super(props);
    this.state = { guaio: null, giro: 0 };
  }

  static getDerivedStateFromError(errore) {
    return { guaio: errore };
  }

  componentDidCatch(errore, info) {
    this.voce = scriviErrore(errore, this.props.dove, info);
    // In console resta comunque: in sviluppo è lì che si guarda.
    console.error('[SQUAD] ' + (this.props.dove || 'app'), errore, info);
  }

  /* Riprovare, non ricaricare.
   *
   * Cambiando la chiave del figlio React lo ributta giù e lo rifà da zero,
   * senza toccare la pagina: la sessione resta aperta, la copia locale della
   * partita resta dov'è, e chi segna non deve sperare che la rete ci sia. Se
   * l'errore era una condizione passeggera — un dato arrivato a metà — questo
   * basta. Se torna subito, almeno si è capito che non era passeggera. */
  riprova = () => {
    this.setState(s => ({ guaio: null, giro: s.giro + 1 }));
  };

  copia = () => {
    const v = this.voce || {};
    const righe = [
      'SQUAD — errore',
      v.quando, v.dove, v.messaggio, '', v.stack, '', v.componenti
    ];
    /* Anche quelli di prima. Non è zelo: quello che spiega un difetto non è
     * sempre l'ultimo errore, e su un tablet in palestra nessuno apre gli
     * strumenti da sviluppatore per rileggere `localStorage`. Se il testo si
     * copia e si incolla in un messaggio, la diagnosi è fatta. */
    const prima = leggiErrori().filter(x => x.quando !== v.quando);
    if (prima.length) {
      righe.push('', '--- prima di questo ---');
      prima.forEach(x => righe.push('', x.quando + ' · ' + x.dove + ' · ' + x.messaggio));
    }
    try { navigator.clipboard.writeText(righe.join('\n')); } catch (e) { /* niente */ }
  };

  render() {
    if (!this.state.guaio) {
      return <React.Fragment key={this.state.giro}>{this.props.children}</React.Fragment>;
    }

    const v = this.voce || { messaggio: String(this.state.guaio) };
    const quanti = leggiErrori().length;

    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl vetro-alto orlo p-5 shadow-lg">
          <h1 className="text-[19px] font-bold text-testo">Qualcosa si è rotto qui</h1>

          {/* La prima cosa da dire è che il lavoro c'è ancora: è la sola cosa
              che interessa a chi sta segnando una partita. */}
          <p className="mt-2.5 text-[14px] leading-relaxed text-soffuso">
            Non è andato perso niente: la partita che stavi segnando è scritta su questo
            dispositivo e riparte da dove era. Prova a riaprire questa schermata — se si
            riapre, continua. Non ricaricare la pagina se non c’è rete.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={this.riprova}
              className="rounded-xl vivo px-4 py-2 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Riapri questa schermata
            </button>
            <button
              onClick={this.copia}
              className="rounded-xl vetro orlo px-4 py-2 text-[14px] font-semibold text-testo transition-colors hover:bg-pannello/16"
            >
              Copia il messaggio
            </button>
          </div>

          {/* Il messaggio in chiaro. Non lo capirà chi segna, ma lo può
              incollare — e un errore incollato è un errore che si corregge. */}
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-tenue">
            Cosa dice l’errore
          </p>
          <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-pannello/10 p-3 text-[11.5px] leading-relaxed text-soffuso">
            {v.messaggio}
            {v.stack ? '\n\n' + v.stack : ''}
          </pre>

          <p className="mt-3 text-[12px] leading-relaxed text-tenue">
            Resta scritto su questo dispositivo insieme agli ultimi quattro, anche dopo
            un ricaricamento{quanti > 1 ? ' — adesso ce ne sono ' + quanti : ''}. Il
            pulsante qui sopra li copia tutti.
          </p>
        </div>
      </div>
    );
  }
}
