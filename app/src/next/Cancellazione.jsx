import React, { useState } from 'react';
import { state } from '../state.js';
import { fetchPlayerPersonalData, erasePlayer } from '../api/privacy.js';
import { safeName } from '../utils/csv.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Scheletro, cx } from './ui.jsx';
import { Finestra, Campo, Testo, Scelta, useAvviso } from './moduli.jsx';

/* Accesso ai dati e cancellazione.
 *
 * Sono i due diritti che una famiglia può esercitare, e questa è l'unica
 * schermata dell'app che fa una cosa davvero irreversibile.
 *
 * Quindi qui si va contro tutto il resto del disegno: NIENTE scorciatoie,
 * niente pulsante comodo, e la conferma non è un "sei sicuro?" — bisogna
 * scrivere il nome dell'atleta. Un "sei sicuro?" lo si preme senza leggere;
 * un nome da trascrivere costringe a guardare chi si sta cancellando.
 *
 * E si dice esattamente cosa resta, perché "cancella tutto" sarebbe una
 * bugia: i movimenti contabili la legge impone di conservarli, e restano
 * senza nome.
 */

// downloadCsv prende intestazioni e righe: qui il file e' JSON, e forzarlo
// dentro un formato tabellare vorrebbe dire appiattire una struttura annidata
// proprio quando serve completa.
function scaricaJson(nomeFile, oggetto) {
  const blob = new Blob([JSON.stringify(oggetto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Cancellazione({ onChiudi }) {
  const [scelto, setScelto] = useState('');
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [conferma, setConferma] = useState('');
  const [motivo, setMotivo] = useState('');
  const [lavora, setLavora] = useState(false);
  const [errore, setErrore] = useState('');
  const avvisa = useAvviso();

  const rosa = state.roster.slice().sort((a, b) => a.name.localeCompare(b.name));
  const p = rosa.find(x => x.id === scelto);
  const nomeGiusto = p && conferma.trim().toLowerCase() === p.name.trim().toLowerCase();

  async function leggi(id) {
    setScelto(id);
    setDati(null);
    setConferma('');
    setErrore('');
    if (!id || inCampione()) return;
    setCaricando(true);
    try {
      setDati(await fetchPlayerPersonalData(id));
    } catch (e) {
      setErrore((e && e.message) || 'Non è stato possibile leggere i dati.');
    } finally {
      setCaricando(false);
    }
  }

  return (
    <Finestra
      titolo="Dati personali di un atleta"
      sotto="Da qui si risponde a una richiesta di accesso ai dati o di cancellazione."
      onChiudi={lavora ? () => {} : onChiudi}
      larga
    >
      <Campo etichetta="Atleta">
        <Scelta value={scelto} onChange={e => leggi(e.target.value)}>
          <option value="">— scegli —</option>
          {rosa.map(x => <option key={x.id} value={x.id}>{x.name} · #{x.number}</option>)}
        </Scelta>
      </Campo>

      {caricando && <div className="mt-5"><Scheletro righe={3} /></div>}

      {p && !caricando && (
        <>
          {/* ------------------------------------------------- accesso ai dati */}
          <div className="mt-6">
            <Etichetta className="mb-2.5">Cosa conserviamo su {p.name}</Etichetta>
            <Pannello className="pad-pannello-stretto">
              {dati ? (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-soffuso">
                  {JSON.stringify(dati, null, 2)}
                </pre>
              ) : (
                <p className="text-[12.5px] text-tenue">
                  {inCampione()
                    ? 'Nell’anteprima con dati di esempio non c’è niente da leggere.'
                    : 'Nessun dato restituito.'}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <Pulsante
                  className="py-1.5 text-[11.5px]"
                  disabled={!dati}
                  onClick={() => {
                    // Un file da consegnare, non uno schermo da fotografare:
                    // una richiesta di accesso si evade con un documento.
                    scaricaJson(`dati_${safeName(p.name)}.json`, dati);
                    avvisa('File scaricato');
                  }}
                >
                  Scarica il file da consegnare
                </Pulsante>
              </div>
            </Pannello>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
              È tutto ciò che l’app conserva su questa persona, in un colpo solo: cercare tabella
              per tabella è il modo in cui si dimentica qualcosa.
            </p>
          </div>

          {/* -------------------------------------------------- cancellazione */}
          <div className="mt-8">
            <Etichetta className="mb-2.5 !text-rosso">Cancellazione definitiva</Etichetta>

            <div className="rounded-lg border border-rosso/25 bg-rosso/6 px-4 py-4">
              <p className="text-[13px] font-semibold leading-relaxed">
                Cosa succede, esattamente:
              </p>
              <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed text-soffuso">
                <li>· il nome sparisce ovunque compaia, sostituito da un segnaposto;</li>
                <li>· i documenti sanitari — certificato, tesseramento — vengono eliminati;</li>
                <li>· contatti, codice fiscale, data di nascita e fotografia vengono cancellati;</li>
                <li>
                  · <b className="text-testo">i movimenti contabili restano, senza nome</b>: la
                  legge impone di conservarli, e cancellarli renderebbe i bilanci falsi.
                </li>
              </ul>
              <p className="mt-3 text-[12.5px] font-semibold text-rosso">
                Non si torna indietro. Non c’è un cestino.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <Campo
                etichetta="Motivo"
                aiuto="Resta scritto: serve a dimostrare, se te lo chiedono, perché quei dati non ci sono più."
              >
                <Testo
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Es. richiesta della famiglia del 12 settembre"
                />
              </Campo>

              <Campo
                etichetta={`Scrivi «${p.name}» per confermare`}
                aiuto="Un «sei sicuro?» si preme senza leggere. Un nome da trascrivere costringe a guardare chi si sta cancellando."
              >
                <Testo
                  value={conferma}
                  onChange={e => setConferma(e.target.value)}
                  placeholder={p.name}
                />
              </Campo>
            </div>

            {errore && (
              <div className="mt-4 rounded-lg bg-rosso/12 px-3.5 py-2.5 text-[12.5px] text-rosso">{errore}</div>
            )}

            <button
              type="button"
              disabled={!nomeGiusto || !motivo.trim() || lavora}
              onClick={async () => {
                setErrore('');
                if (inCampione()) { setErrore('Nell’anteprima con dati di esempio non si cancella niente.'); return; }
                setLavora(true);
                try {
                  await erasePlayer(p.id, motivo.trim());
                  state.roster = state.roster.filter(x => x.id !== p.id);
                  avvisa('Dati cancellati');
                  onChiudi();
                } catch (e) {
                  console.error(e);
                  setErrore((e && e.message) || 'Cancellazione non riuscita.');
                } finally {
                  setLavora(false);
                }
              }}
              className={cx(
                'mt-5 w-full rounded-lg py-3.5 text-[14px] font-semibold transition-all',
                nomeGiusto && motivo.trim() && !lavora
                  ? 'bg-rosso text-white hover:brightness-110'
                  : 'bg-pannello/12 text-tenue'
              )}
            >
              {lavora ? 'Cancellazione…' : `Cancella i dati di ${p.name}`}
            </button>
          </div>
        </>
      )}
    </Finestra>
  );
}
