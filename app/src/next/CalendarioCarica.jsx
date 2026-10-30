import React, { useState } from 'react';
import { state } from '../state.js';
import { Croce } from './icone.jsx';
import { bulkInsertMatches } from '../api/calendar.js';
import { parseMatchesFromLines } from '../utils/calendarioTesto.js';
import { Pannello, Etichetta, Pulsante, cx, AzioneRiga } from './ui.jsx';
import { Finestra, Campo, Testo, Data, Scelta, Spunta } from './moduli.jsx';
import { CASA, TRASFERTA, IGNOTO, doveSiGioca } from '../utils/dove.js';

/* CARICARE IL CALENDARIO.
 *
 * Una partita alla volta c'era già. Un campionato sono ventisei partite, e
 * ventisei volte un modulo non è «caricare il calendario»: è un pomeriggio.
 * Il lettore del PDF federale esisteva — con il suo riconoscimento delle date,
 * delle giornate e del campo — ma viveva nella vecchia interfaccia, quella che
 * non si disegna più. Lo stato vuoto del calendario arrivava a dire «puoi
 * caricare il PDF del calendario federale dall'app attuale», cioè mandava a
 * una schermata che non esiste.
 *
 * DUE STRADE, perché il PDF non sempre c'è:
 *
 *   — il PDF della federazione, letto riga per riga;
 *   — il testo incollato, che per il lettore è la stessa cosa: righe. Costa
 *     anche meno, perché non carica pdf.js — quattrocento chilobyte — per
 *     leggere dieci righe che si hanno già.
 *
 * E UNA VERIFICA IN MEZZO, che non è una cortesia. Il riconoscimento
 * automatico sbaglia: una riga di intestazione con una data dentro, un nome di
 * squadra scritto in due modi, una partita rinviata. Salvare ventisei righe
 * senza guardarle vuol dire scoprire l'errore la domenica in cui la squadra va
 * nel posto sbagliato. Qui si guardano, si correggono e si deselezionano prima
 * che tocchino il database.
 *
 * Quello che il lettore NON fa, e che qui si rispetta: se il nostro nome non
 * compare nella riga, «casa o trasferta» resta DA DEFINIRE. La vecchia
 * schermata in quel caso preselezionava «casa», ed è esattamente il difetto
 * chiuso in `dove.js` — una supposizione presentata come un fatto.
 */

function rigaVuota() {
  return {
    include: true, giornata: '', date: '', time: '',
    dove: IGNOTO, opponent: '', location: '', sourceLine: null
  };
}

// Dal risultato del lettore alla riga che si modifica a mano. `home` arriva
// come true/false/null, e il null resta «da definire».
function daLetta(m) {
  return {
    include: true,
    giornata: m.giornata == null ? '' : String(m.giornata),
    date: m.date || '',
    time: m.time || '',
    dove: doveSiGioca(m),
    opponent: m.opponent || '',
    location: m.location || '',
    sourceLine: m.sourceLine || null
  };
}

export function CaricaCalendario({ onChiudi, onFatto }) {
  const [righe, setRighe] = useState(null);      // null = non si è ancora letto niente
  const [testo, setTesto] = useState('');
  const [lavora, setLavora] = useState('');
  const [errore, setErrore] = useState('');

  const nostroNome = (state.teamProfile || {}).name || '';

  function leggiRighe(righeTesto, provenienza) {
    const trovate = parseMatchesFromLines(righeTesto, nostroNome);
    if (trovate.length === 0) {
      setErrore(
        'Non ho riconosciuto nessuna partita ' + provenienza + '. '
        + 'Puoi aggiungerle a mano qui sotto, oppure chiudere e riprovare con un altro file.'
      );
      setRighe([rigaVuota()]);
      return;
    }
    setErrore('');
    setRighe(trovate.map(daLetta));
  }

  async function daPdf(file) {
    if (!file) return;
    setErrore('');
    setLavora('pdf');
    try {
      const buf = await file.arrayBuffer();
      // pdf.js si carica SOLO qui: chi incolla il testo non lo paga.
      const { extractTextLines } = await import('../utils/pdfParser.js');
      leggiRighe(await extractTextLines(buf), 'in questo PDF');
    } catch (e) {
      console.error(e);
      setErrore(
        'Non ho potuto leggere il PDF: ' + ((e && e.message) || 'formato non riconosciuto')
        + '. Prova a copiare il testo del calendario e incollarlo qui sotto.'
      );
    } finally {
      setLavora('');
    }
  }

  function cambia(i, campo, valore) {
    setRighe(r => r.map((x, k) => (k === i ? { ...x, [campo]: valore } : x)));
  }

  const buone = (righe || []).filter(r => r.include && r.opponent.trim() && r.date);

  async function salva() {
    setErrore('');
    if (buone.length === 0) {
      setErrore('Serve almeno una riga selezionata con avversario e data.');
      return;
    }
    setLavora('salva');
    try {
      const creati = await bulkInsertMatches(
        state.teamProfile.id,
        state.activeSectorId,
        buone.map(r => ({
          opponent: r.opponent.trim(),
          date: r.date,
          time: r.time.trim() || null,
          location: r.location.trim() || null,
          home: r.dove === CASA ? true : (r.dove === TRASFERTA ? false : null),
          giornata: r.giornata.trim() ? parseInt(r.giornata, 10) : null
        }))
      );
      (creati || []).forEach(c => state.calendar.push(c));
      const saltate = buone.length - (creati || []).length;
      onFatto(
        (creati || []).length + ' partite in calendario'
        + (saltate > 0 ? ' · ' + saltate + ' già presenti' : '')
      );
      onChiudi();
    } catch (e) {
      console.error(e);
      setErrore((e && e.message) || 'Non è stato possibile salvare il calendario.');
    } finally {
      setLavora('');
    }
  }

  return (
    <Finestra
      titolo="Carica il calendario"
      sotto={righe
        ? 'Controlla ogni riga prima di salvare: il riconoscimento automatico sbaglia, e una partita sbagliata manda la squadra nel posto sbagliato.'
        : 'Dal PDF della federazione, oppure incollando il testo del calendario.'}
      larga
      onChiudi={lavora ? () => {} : onChiudi}
      azioni={
        <>
          {errore && (
            <div className="mb-3 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] leading-snug text-rosso">
              {errore}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            {righe && (
              <span className="mr-auto text-[12.5px] text-tenue">
                {buone.length} da salvare{righe.length > buone.length
                  ? ' · ' + (righe.length - buone.length) + ' no'
                  : ''}
              </span>
            )}
            <Pulsante variante="nudo" onClick={onChiudi} disabled={!!lavora}>Annulla</Pulsante>
            {righe && (
              <Pulsante variante="primario" onClick={salva} disabled={!!lavora}>
                {lavora === 'salva' ? 'Salvo…' : 'Salva in calendario'}
              </Pulsante>
            )}
          </div>
        </>
      }
    >
      {!righe ? (
        <div className="space-y-4">
          <Pannello className="pad-pannello-stretto">
            <Etichetta>Il PDF della federazione</Etichetta>
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-bordo/35 px-4 py-6 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => daPdf(e.target.files && e.target.files[0])}
              />
              {lavora === 'pdf' ? 'Sto leggendo…' : 'Scegli il file PDF'}
            </label>
            <p className="mt-3 text-[12.5px] leading-relaxed text-tenue">
              Riconosce data, ora, giornata, avversario e campo. Dove non riconosce il nostro
              nome lascia «da definire» invece di indovinare.
            </p>
          </Pannello>

          <Pannello className="pad-pannello-stretto">
            <Etichetta>Oppure incolla il testo</Etichetta>
            <textarea
              value={testo}
              onChange={e => setTesto(e.target.value)}
              rows={6}
              placeholder={'1ª giornata 12/10/2026 18:30 ' + (nostroNome || 'Noi') + ' - Virtus Ragalna'}
              className="mt-3 w-full rounded-lg bg-pannello/8 px-3.5 py-3 text-[13px] leading-relaxed outline-none ring-1 ring-bordo/15 focus:ring-blu"
            />
            <Pulsante
              className="mt-3 w-full"
              disabled={!testo.trim() || !!lavora}
              onClick={() => leggiRighe(testo.split(/\r?\n/), 'nel testo incollato')}
            >
              Leggi il testo
            </Pulsante>
          </Pannello>
        </div>
      ) : (
        <div className="space-y-2.5">
          {righe.map((r, i) => (
            <Pannello
              key={i}
              className={cx('pad-pannello-stretto', !r.include && 'opacity-50')}
            >
              <div className="flex items-start gap-3">
                <Spunta
                  checked={r.include}
                  onChange={e => cambia(i, 'include', e.target.checked)}
                  etichetta={r.include ? 'La salvo' : 'Non la salvo'}
                />
                <div className="min-w-0 flex-1 text-[11.5px] leading-snug text-tenue">
                  {/* La riga come stava sul documento: è l'unico modo di
                      controllare che il riconoscimento non abbia mescolato due
                      partite scritte vicine. */}
                  {r.sourceLine || 'Riga aggiunta a mano'}
                </div>
                <AzioneRiga
                  etichetta="Togli"
                  pericolo
                  onClick={() => setRighe(v => (v.length > 1 ? v.filter((_, k) => k !== i) : [rigaVuota()]))}
                >
                  <Croce />
                </AzioneRiga>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Campo etichetta="Giornata">
                  <Testo
                    inputMode="numeric"
                    value={r.giornata}
                    onChange={e => cambia(i, 'giornata', e.target.value.replace(/\D/g, '').slice(0, 2))}
                  />
                </Campo>
                <Campo etichetta="Data">
                  <Data value={r.date} onChange={e => cambia(i, 'date', e.target.value)} />
                </Campo>
                <Campo etichetta="Ora">
                  <Testo value={r.time} placeholder="18:30" onChange={e => cambia(i, 'time', e.target.value)} />
                </Campo>
                <Campo etichetta="Dove">
                  <Scelta value={r.dove} onChange={e => cambia(i, 'dove', e.target.value)}>
                    <option value={IGNOTO}>Da definire</option>
                    <option value={CASA}>In casa</option>
                    <option value={TRASFERTA}>In trasferta</option>
                  </Scelta>
                </Campo>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo etichetta="Avversario">
                  <Testo value={r.opponent} onChange={e => cambia(i, 'opponent', e.target.value)} />
                </Campo>
                <Campo etichetta="Campo">
                  <Testo value={r.location} onChange={e => cambia(i, 'location', e.target.value)} />
                </Campo>
              </div>

              {r.include && (!r.opponent.trim() || !r.date) && (
                <p className="mt-2.5 text-[12px] font-semibold text-ambra">
                  Senza avversario e data questa riga non si salva.
                </p>
              )}
            </Pannello>
          ))}

          <Pulsante
            className="w-full"
            onClick={() => setRighe(v => [...v, rigaVuota()])}
          >
            + Aggiungi una riga
          </Pulsante>
        </div>
      )}
    </Finestra>
  );
}
