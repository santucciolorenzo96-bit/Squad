import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cx, Pannello, Etichetta, Pulsante } from './ui.jsx';

/* Finestre, moduli e avvisi.
 *
 * L'app attuale ha `formModal`, che costruisce i campi da una stringa di HTML e
 * poi li rilegge con getElementById. Funziona, ma qui non serve replicarlo: in
 * React i campi sono componenti e il valore vive nello stato, quindi il modulo
 * si scrive una volta e non c'è nessun ponte fra chi disegna e chi legge.
 *
 * Quello che invece va replicato, perché costò caro impararlo, è il
 * comportamento del pulsante di conferma: si disabilita mentre lavora, e se
 * l'operazione fallisce l'errore SI VEDE. Un salvataggio che non fa niente e
 * non dice niente è il difetto peggiore che questa app abbia avuto.
 */

/* ------------------------------------------------------------------ avvisi */
const ContestoAvvisi = createContext(() => {});

export function useAvviso() {
  return useContext(ContestoAvvisi);
}

export function ProvvederAvvisi({ children }) {
  const [avvisi, setAvvisi] = useState([]);
  const prossimo = useRef(0);

  const avvisa = useCallback((testo, tono) => {
    const id = ++prossimo.current;
    setAvvisi(a => [...a, { id, testo, tono }]);
    setTimeout(() => setAvvisi(a => a.filter(x => x.id !== id)), 4000);
  }, []);

  return (
    <ContestoAvvisi.Provider value={avvisa}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {avvisi.map(a => (
          <div
            key={a.id}
            className={cx(
              'pointer-events-auto max-w-[min(92vw,26rem)] rounded-lg vetro-alto orlo px-4 py-3 shadow-lg animate-salita',
              'text-[13px] font-medium',
              a.tono === 'errore' ? 'text-rosso' : 'text-testo'
            )}
          >
            {a.testo}
          </div>
        ))}
      </div>
    </ContestoAvvisi.Provider>
  );
}

/* ----------------------------------------------------------------- finestra */
// Esc chiude, il clic fuori chiude, e la pagina sotto non scorre. Sono tre
// cose che si notano solo quando mancano.
export function Finestra({ titolo, sotto, onChiudi, larga = false, azioni, children }) {
  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tasto);
      document.body.style.overflow = prima;
    };
  }, [onChiudi]);

  // In un portale attaccato al body, e non dove sta il componente: un
  // antenato con un'animazione o una trasformazione diventa il contenitore di
  // riferimento per gli elementi fissi, e la finestra finirebbe ancorata alla
  // colonna del contenuto invece che alla pagina. Succede, e si vede.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" onMouseDown={onChiudi}>
      <div className="absolute inset-0 bg-fondo/75 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={e => e.stopPropagation()}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl vetro-alto orlo shadow-lg animate-salita',
          'sm:rounded-2xl',
          larga ? 'sm:max-w-[46rem]' : 'sm:max-w-[30rem]'
        )}
      >
        <div className="shrink-0 border-b border-bordo/10 px-5 pb-4 pt-5 sm:px-6">
          {/* La maniglia: su telefono dice che il foglio si trascina via, ed è
              il primo gesto che chiunque prova. */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pannello/25 sm:hidden" />
          <h2 className="text-[19px] font-bold leading-tight tracking-tight">{titolo}</h2>
          {sotto && <p className="mt-1.5 text-[12.5px] leading-snug text-tenue">{sotto}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {azioni && (
          <div className="shrink-0 border-t border-bordo/10 px-5 py-4 sm:px-6">{azioni}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------- modulo */
// `onInvia` può restituire una stringa: quella è l'obiezione, e compare sopra i
// pulsanti invece di far finta che sia andato tutto bene. Se lancia, l'errore
// si vede lo stesso — è il caso in cui prima non succedeva niente.
export function Modulo({ titolo, sotto, onChiudi, onInvia, etichettaInvia = 'Salva', larga, children }) {
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  async function invia() {
    setErrore('');
    setLavora(true);
    try {
      const obiezione = await onInvia();
      if (typeof obiezione === 'string' && obiezione) { setErrore(obiezione); return; }
      onChiudi();
    } catch (e) {
      console.error(e);
      setErrore((e && e.message) || 'Operazione non riuscita.');
    } finally {
      setLavora(false);
    }
  }

  return (
    <Finestra
      titolo={titolo}
      sotto={sotto}
      onChiudi={lavora ? () => {} : onChiudi}
      larga={larga}
      azioni={
        <>
          {errore && (
            <div className="mb-3 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] leading-snug text-rosso">
              {errore}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Pulsante variante="nudo" onClick={onChiudi} disabled={lavora}>Annulla</Pulsante>
            <Pulsante variante="primario" onClick={invia} disabled={lavora}>
              {lavora ? 'Attendi…' : etichettaInvia}
            </Pulsante>
          </div>
        </>
      }
    >
      <div className="space-y-4">{children}</div>
    </Finestra>
  );
}

/* ------------------------------------------------------------------ conferma */
export function Conferma({ titolo, testo, etichetta = 'Conferma', pericolo = true, onChiudi, onConferma }) {
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');

  async function esegui() {
    setErrore('');
    setLavora(true);
    try {
      await onConferma();
      onChiudi();
    } catch (e) {
      console.error(e);
      setErrore((e && e.message) || 'Operazione non riuscita.');
    } finally {
      setLavora(false);
    }
  }

  return (
    <Finestra
      titolo={titolo}
      sotto={testo}
      onChiudi={lavora ? () => {} : onChiudi}
      azioni={
        <>
          {errore && (
            <div className="mb-3 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] text-rosso">{errore}</div>
          )}
          <div className="flex justify-end gap-2">
            <Pulsante variante="nudo" onClick={onChiudi} disabled={lavora}>Annulla</Pulsante>
            <button
              type="button"
              onClick={esegui}
              disabled={lavora}
              className={cx(
                'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] font-medium',
                'transition-all duration-150 disabled:opacity-40',
                pericolo
                  ? 'bg-rosso text-white hover:brightness-110'
                  : 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              )}
            >
              {lavora ? 'Attendi…' : etichetta}
            </button>
          </div>
        </>
      }
    >
      <div />
    </Finestra>
  );
}

/* -------------------------------------------------------------------- campi */
const BASE_CAMPO =
  'w-full rounded-lg vetro orlo px-3.5 py-2.5 text-[14px] text-testo placeholder:text-tenue ' +
  'transition-colors focus:border-blu/60 focus:outline-none';

export function Campo({ etichetta, aiuto, children }) {
  return (
    <label className="block">
      {etichetta && <Etichetta className="mb-1.5">{etichetta}</Etichetta>}
      {children}
      {aiuto && <p className="mt-1.5 text-[11.5px] leading-snug text-tenue">{aiuto}</p>}
    </label>
  );
}

export function Testo({ className, ...resto }) {
  return <input type="text" className={cx(BASE_CAMPO, className)} {...resto} />;
}

export function Data({ className, ...resto }) {
  // `color-scheme` fa disegnare al browser il selettore di data nel tema
  // giusto: senza, su fondo scuro compare un calendario bianco.
  return <input type="date" style={{ colorScheme: 'inherit' }} className={cx(BASE_CAMPO, className)} {...resto} />;
}

export function Scelta({ className, children, ...resto }) {
  return (
    <select className={cx(BASE_CAMPO, 'appearance-none pr-9', className)} {...resto}>
      {children}
    </select>
  );
}

export function Spunta({ etichetta, ...resto }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded-sm accent-[rgb(var(--blu))]"
        {...resto}
      />
      <span className="min-w-0">{etichetta}</span>
    </label>
  );
}

/* ------------------------------------------------------------- interruttore */
// Il selettore a pastiglie: due o tre viste della stessa cosa. Lo usano
// Allenamenti (futuri/passati), Calendario (prossime/giocate) e Presenze.
export function Interruttore({ valore, onCambia, voci }) {
  return (
    <div className="inline-flex gap-1 rounded-full vetro orlo p-1">
      {voci.map(v => (
        <button
          key={v.id}
          onClick={() => onCambia(v.id)}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150',
            valore === v.id
              ? 'bg-gradient-to-br from-blu to-blu2 text-white shadow-blu'
              : 'text-tenue hover:text-testo'
          )}
        >
          {v.testo}
          {v.conteggio != null && (
            <span className={cx('ml-1.5 text-[11px]', valore === v.id ? 'opacity-75' : 'opacity-60')}>
              {v.conteggio}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- errore */
export function ErroreCaricamento({ cosa, errore, onRiprova }) {
  return (
    <Pannello className="pad-pannello text-center">
      <p className="text-[13.5px] text-testo">Non è stato possibile caricare {cosa}.</p>
      {errore && <p className="mt-1.5 text-[12px] text-tenue">{errore.message || String(errore)}</p>}
      {onRiprova && (
        <div className="mt-4 flex justify-center">
          <Pulsante onClick={onRiprova}>Riprova</Pulsante>
        </div>
      )}
    </Pannello>
  );
}
