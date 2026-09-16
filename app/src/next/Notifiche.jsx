import React, { useState } from 'react';
import { state } from '../state.js';
import { refreshNotifications } from '../router.js';
import { markNotificationsRead } from '../api/notifications.js';
import { descriviNotifica, daLeggere, raggruppaPerGiorno } from '../utils/notifiche.js';
import { IconaSezione } from './icone.jsx';
import { Etichetta, Vuoto, cx } from './ui.jsx';
import { Finestra } from './moduli.jsx';

/* La campanella.
 *
 * Nel ridisegno dell'interfaccia era rimasta indietro: il database continuava
 * a scrivere le notifiche — allenamenti spostati, documenti da verificare,
 * comunicazioni — e nessuno poteva più leggerle. Una società che sposta un
 * allenamento e si fida dell'app per avvisare il gruppo è il caso in cui una
 * notifica mancata costa una palestra vuota.
 *
 * Torna con due cose che prima non aveva:
 *
 *  - l'ICONA DELLA SEZIONE da cui la notifica viene, con il suo colore. Prima
 *    erano dieci righe di testo tutte uguali e bisognava leggerle tutte per
 *    sapere di cosa parlassero.
 *  - il TIPO DI MODIFICA scritto sopra il titolo. «Allenamento spostato» dice
 *    cos'è successo prima ancora di leggere quale allenamento.
 */

function Campana({ dim = 20, className }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.6a4.6 4.6 0 0 0-4.6 4.6c0 3.4-1.1 4.5-1.6 5.1-.3.3-.1.9.4.9h11.6c.5 0 .7-.6.4-.9-.5-.6-1.6-1.7-1.6-5.1A4.6 4.6 0 0 0 10 2.6Z" />
      <path d="M8.2 16.2a2 2 0 0 0 3.6 0" />
    </svg>
  );
}

/* Una riga. Tocco = letta, e porta dove la notifica parla. */
function Riga({ n, ultima, onVai }) {
  const d = descriviNotifica(n, state.sectors);
  const io = (state.currentUser || {}).id;
  // Non letta vale solo per le notifiche di qualcun altro: la propria non è
  // una novità per chi l'ha provocata.
  const nuova = !n.read && n.actor_id !== io;

  function tocca() {
    if (!n.read) {
      n.read = true;
      markNotificationsRead([n.id]).catch(() => { /* la riga resta segnata qui */ });
    }
    if (d.destinazione) onVai(d.destinazione);
  }

  return (
    <button
      onClick={tocca}
      className={cx(
        'flex w-full items-start gap-3 py-3 text-left transition-colors',
        !ultima && 'border-b border-bordo/8',
        d.destinazione && 'hover:bg-pannello/8'
      )}
    >
      {/* Da dove viene: stessa icona e stesso colore della voce di menu. */}
      <IconaSezione id={d.sezione} dim={30} className="mt-0.5 shrink-0" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="etichetta truncate">{d.azione}</span>
          {d.personale && (
            <span className="shrink-0 rounded-full bg-blu/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-etichetta text-blu">
              Per te
            </span>
          )}
        </span>

        <span className={cx('mt-0.5 block text-[14px] leading-snug', nuova ? 'font-bold' : 'font-semibold')}>
          {d.titolo}
        </span>

        {d.corpo && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-soffuso">{d.corpo}</span>
        )}

        <span className="mt-1 block text-[11.5px] text-tenue">
          {[d.settore, d.quando].filter(Boolean).join(' · ')}
        </span>
      </span>

      {nuova && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blu" aria-label="Da leggere" />}
    </button>
  );
}

export function Campanella({ onSezione }) {
  const [aperto, setAperto] = useState(false);
  const [, ridisegna] = useState(0);

  const io = (state.currentUser || {}).id;
  const nuove = daLeggere(state.notifications, io);

  async function apri() {
    setAperto(true);
    // Le notifiche arrivano all'avvio e poi stanno ferme. Chi apre la
    // campanella sta chiedendo proprio «c'è qualcosa di nuovo?»: è il momento
    // esatto in cui vale la pena richiederle.
    try {
      await refreshNotifications();
      ridisegna(x => x + 1);
    } catch (e) {
      // Senza rete si guardano quelle che già si hanno: sono comunque le
      // ultime che l'app ha visto.
    }
  }

  function segnaTutte() {
    (state.notifications || []).forEach(n => { n.read = true; });
    ridisegna(x => x + 1);
    markNotificationsRead(null).catch(() => { /* restano segnate qui */ });
  }

  function vai(sezione) {
    setAperto(false);
    onSezione(sezione);
  }

  const gruppi = raggruppaPerGiorno(state.notifications);

  return (
    <>
      <button
        onClick={apri}
        aria-label={nuove ? `Notifiche, ${nuove} da leggere` : 'Notifiche'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full vetro orlo transition-colors hover:bg-pannello/12"
      >
        <Campana dim={19} className="text-soffuso" />
        {nuove > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rosso px-1 text-[10px] font-bold leading-none text-white">
            {nuove > 9 ? '9+' : nuove}
          </span>
        )}
      </button>

      {aperto && (
        <Finestra
          titolo="Notifiche"
          sotto={nuove > 0 ? `${nuove} da leggere` : 'Tutto letto.'}
          onChiudi={() => setAperto(false)}
          azioni={
            nuove > 0 ? (
              <button
                onClick={segnaTutte}
                className="w-full rounded-lg vetro orlo py-2.5 text-[13px] font-semibold transition-colors hover:bg-pannello/12"
              >
                Segna tutte come lette
              </button>
            ) : null
          }
        >
          {gruppi.length === 0 ? (
            <Vuoto>
              Nessuna notifica. Arrivano quando qualcuno sposta un allenamento, carica un
              documento o manda una comunicazione.
            </Vuoto>
          ) : (
            <div className="-my-3">
              {gruppi.map((g, i) => (
                <div key={g.giorno + i}>
                  <Etichetta className={cx('pb-1', i === 0 ? 'pt-3' : 'pt-5')}>{g.giorno}</Etichetta>
                  {g.righe.map((n, j) => (
                    <Riga key={n.id} n={n} ultima={j === g.righe.length - 1} onVai={vai} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </Finestra>
      )}
    </>
  );
}
