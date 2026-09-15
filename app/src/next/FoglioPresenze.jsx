import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchAttendance, setAttendance } from '../api/attendance.js';
import { fetchPlayerPhotoUrls } from '../api/roster.js';
import { inCampione } from './campione.js';
import { Etichetta, Avatar, Scheletro, Vuoto, Cerca, NessunRisultato, cx } from './ui.jsx';
import { Finestra, useAvviso } from './moduli.jsx';
import { contiene } from '../utils/format.js';

/* Segnare le presenze.
 *
 * Si fa in palestra, in piedi, con venti ragazzi che arrivano alla spicciolata.
 * Da lì vengono le tre scelte che contano:
 *
 * 1. TUTTI PRESENTI CON UN TOCCO. All'allenamento normale ci sono quasi tutti:
 *    segnare venti presenti uno per uno per poi correggerne due è lavoro
 *    inventato. Si parte da «tutti presenti» e si tolgono i mancanti — che è
 *    anche il modo in cui un allenatore guarda il gruppo: conta chi manca.
 *
 * 2. OGNI TOCCO SALVA SUBITO, senza un pulsante «salva» in fondo. Un foglio
 *    presenze compilato a metà e mai confermato è peggio di uno vuoto: sembra
 *    fatto. Se un salvataggio non riesce lo stato torna com'era e lo dice.
 *
 * 3. IN CIMA SI LEGGE QUANTI MANCANO ANCORA. È l'unica domanda che ci si fa
 *    mentre si compila: ho finito?
 */

const STATI = [
  { key: 'present', breve: 'P', label: 'Presente', on: 'bg-verde/18 text-verde ring-verde/35' },
  { key: 'absent', breve: 'A', label: 'Assente', on: 'bg-rosso/16 text-rosso ring-rosso/35' },
  { key: 'excused', breve: 'G', label: 'Giustificato', on: 'bg-ambra/16 text-ambra ring-ambra/35' }
];

export function FoglioPresenze({ allenamento, onChiudi }) {
  const [stati, setStati] = useState(null);      // { playerId: 'present' | ... }
  const [foto, setFoto] = useState({});
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState('');
  const [inCorso, setInCorso] = useState({});    // chi sta salvando adesso
  const avvisa = useAvviso();

  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setStati({}); return undefined; }
    fetchAttendance(allenamento.id)
      .then(righe => {
        if (!vivo) return;
        const m = {};
        (righe || []).forEach(r => { m[r.player_id] = r.status; });
        setStati(m);
      })
      .catch(e => { if (vivo) setErrore(e); });
    fetchPlayerPhotoUrls(rosa).then(f => { if (vivo) setFoto(f || {}); }).catch(() => {});
    return () => { vivo = false; };
  }, [allenamento.id]);

  // Il salvataggio è ottimista: il tocco si vede subito, e solo se il database
  // rifiuta si torna indietro. Al contrario — aspettare la risposta per
  // colorare il pulsante — segnare venti presenze diventa venti attese.
  async function segna(playerId, stato) {
    if (inCampione()) { setStati(s => ({ ...s, [playerId]: stato })); return; }
    const prima = (stati || {})[playerId];
    setStati(s => ({ ...s, [playerId]: stato }));
    setInCorso(c => ({ ...c, [playerId]: true }));
    try {
      await setAttendance(allenamento.id, playerId, stato);
    } catch (e) {
      setStati(s => ({ ...s, [playerId]: prima }));
      avvisa((e && e.message) || 'Presenza non salvata.', 'errore');
    } finally {
      setInCorso(c => { const n = { ...c }; delete n[playerId]; return n; });
    }
  }

  // «Tutti presenti» tocca solo chi non ha ancora uno stato: chi è già stato
  // segnato assente non deve tornare presente per una scorciatoia.
  async function tuttiPresenti() {
    const daFare = rosa.filter(p => !(stati || {})[p.id]);
    if (daFare.length === 0) return;
    setStati(s => {
      const n = { ...s };
      daFare.forEach(p => { n[p.id] = 'present'; });
      return n;
    });
    if (inCampione()) return;
    try {
      for (const p of daFare) await setAttendance(allenamento.id, p.id, 'present');
      avvisa(daFare.length === 1 ? 'Segnato presente' : daFare.length + ' segnati presenti');
    } catch (e) {
      avvisa('Qualche presenza non è stata salvata: controlla la connessione.', 'errore');
    }
  }

  const conta = (k) => rosa.filter(p => (stati || {})[p.id] === k).length;
  const mancanti = rosa.length - rosa.filter(p => (stati || {})[p.id]).length;
  const visibili = rosa.filter(p => contiene(p.name + ' ' + (p.number || ''), cerca));

  const data = new Date(allenamento.date + 'T00:00:00')
    .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Finestra
      larga
      titolo="Presenze"
      sotto={allenamento.title + ' · ' + data}
      onChiudi={onChiudi}
      azioni={
        <button
          onClick={onChiudi}
          className="w-full rounded-lg vetro orlo py-2.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo"
        >
          Chiudi
        </button>
      }
    >
      {errore ? (
        <Vuoto>Non riesco a leggere le presenze di questo allenamento.</Vuoto>
      ) : !stati ? (
        <Scheletro righe={4} />
      ) : rosa.length === 0 ? (
        <Vuoto>Nessun atleta in rosa per questa categoria.</Vuoto>
      ) : (
        <>
          {/* Il conto, in cima: risponde all'unica domanda che ci si fa
              mentre si compila — ho finito? */}
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px]">
              <span className="font-bold text-verde">{conta('present')} presenti</span>
              {conta('absent') > 0 && <span className="font-bold text-rosso">{conta('absent')} assenti</span>}
              {conta('excused') > 0 && <span className="font-bold text-ambra">{conta('excused')} giustificati</span>}
              {mancanti > 0 && <span className="text-tenue">{mancanti} da segnare</span>}
            </div>
            {mancanti > 0 && (
              <button
                onClick={tuttiPresenti}
                className="shrink-0 rounded-lg bg-verde/14 px-3 py-1.5 text-[11.5px] font-bold text-verde ring-1 ring-verde/30 transition-all hover:bg-verde/22 active:scale-95"
              >
                {mancanti === rosa.length ? 'Tutti presenti' : 'I restanti presenti'}
              </button>
            )}
          </div>

          {rosa.length > 10 && (
            <Cerca
              valore={cerca}
              onCambia={setCerca}
              segnaposto="Cerca un atleta"
              className="mb-3 w-full sm:max-w-xs"
            />
          )}

          {visibili.length === 0 ? (
            <NessunRisultato cosa="Nessun atleta" ago={cerca} />
          ) : (
            <div className="space-y-1.5">
              {visibili.map(p => {
                const suo = stati[p.id];
                return (
                  <div
                    key={p.id}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors',
                      suo ? 'bg-pannello/6' : 'bg-ambra/6'
                    )}
                  >
                    <Avatar nome={p.name} url={foto[p.id]} dim={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold leading-tight">{p.name}</div>
                      {p.number != null && String(p.number).trim() !== '' && (
                        <div className="text-[11px] text-tenue">#{p.number}</div>
                      )}
                    </div>

                    {/* Le tre lettere su schermo stretto, le parole quando c'è
                        spazio: in palestra il pollice cerca un bersaglio, non
                        legge un'etichetta. */}
                    <div className={cx('flex shrink-0 gap-1', inCorso[p.id] && 'opacity-60')}>
                      {STATI.map(s => (
                        <button
                          key={s.key}
                          onClick={() => segna(p.id, s.key)}
                          aria-pressed={suo === s.key}
                          title={s.label}
                          className={cx(
                            'min-w-[2.1rem] rounded-lg px-2 py-1.5 text-[11.5px] font-bold ring-1 transition-all active:scale-95 sm:min-w-0 sm:px-3',
                            suo === s.key
                              ? s.on
                              : 'bg-pannello/8 text-tenue ring-transparent hover:text-soffuso'
                          )}
                        >
                          <span className="sm:hidden">{s.breve}</span>
                          <span className="hidden sm:inline">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3.5 text-[11.5px] leading-relaxed text-tenue">
            Ogni tocco si salva da solo. Le presenze di tutta la stagione si leggono
            in Allenamenti · Presenze.
          </p>
        </>
      )}
    </Finestra>
  );
}
