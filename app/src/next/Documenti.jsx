import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { contiene } from '../utils/format.js';
import { isAdmin } from '../utils/permissions.js';
import { tipiDocumento } from '../utils/sports/index.js';
import { fetchDocumentsForPlayers, getDocumentSignedUrl } from '../api/roster.js';
import { docStatus, DOC_STATE } from '../utils/docStatus.js';
import { EXPORTS } from '../ui/dataExport.js';
import { inCampione, DOCUMENTI_CAMPIONE } from './campione.js';
import { Pannello, Etichetta, Titolo, Pulsante, Vuoto, Scheletro, Stato, Avatar, cx, Cerca, NessunRisultato } from './ui.jsx';
import { useAvviso } from './moduli.jsx';
import { Cancellazione } from './Cancellazione.jsx';
import { SchedaAtleta } from './SchedaAtleta.jsx';
import { IconaSezione, Chevron } from './icone.jsx';
import { oggiISO } from '../utils/format.js';

/* Documenti.
 *
 * Due cose diverse sotto lo stesso nome, e vale la pena tenerle separate:
 * i documenti DEGLI ATLETI (certificati, tesseramenti) che la società raccoglie,
 * e i dati DELLA SOCIETÀ che si portano via in CSV.
 *
 * L'elenco è ordinato per stato e non per nome: un elenco alfabetico costringe
 * a leggerlo tutto per trovare i due che mancano.
 */

const TONO = {
  ok: 'buono', scadenza: 'attesa', verifica: 'attesa',
  scaduto: 'fermo', respinto: 'fermo', mancante: 'fermo'
};


export function Documenti() {
  const [cancella, setCancella] = useState(false);
  const [scheda, setScheda] = useState(null);
  const [documenti, setDocumenti] = useState(null);
  const [tipo, setTipo] = useState(tipiDocumento()[0] ? tipiDocumento()[0].key : null);
  const [cerca, setCerca] = useState('');
  const avvisa = useAvviso();

  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    const ids = rosa.map(p => p.id);
    if (ids.length === 0) { setDocumenti({}); return; }
    if (inCampione()) { setDocumenti(DOCUMENTI_CAMPIONE); return; }
    setDocumenti(null);
    fetchDocumentsForPlayers(ids).catch(() => ({})).then(d => { if (vivo) setDocumenti(d); });
    return () => { vivo = false; };
  }, [rosa]);

  const oggi = oggiISO();
  const righe = documenti
    ? rosa.map(p => {
        const suoi = (documenti[p.id] || []).filter(d => d.doc_type === tipo);
        const stato = docStatus(suoi, oggi);
        // Fra più copie vale quella che copre più a lungo: è la stessa regola
        // con cui si calcola lo stato, e mostrarne un'altra sarebbe una
        // contraddizione visibile.
        const valido = suoi.slice().sort((a, b) =>
          String(b.expires_at || '').localeCompare(String(a.expires_at || '')))[0] || null;
        return { p, stato, doc: valido };
      }).sort((a, b) => (DOC_STATE[b.stato].rank - DOC_STATE[a.stato].rank) || a.p.name.localeCompare(b.p.name))
    : [];

  // Il conto dei non in regola resta quello VERO, non quello dei filtrati:
  // cercare un nome non deve far sembrare che i problemi siano diminuiti.
  const mancanti = righe.filter(r => DOC_STATE[r.stato].tone === 'bad').length;
  const visibili = righe.filter(r => contiene(r.p.name + ' ' + (r.p.number || ''), cerca));

  return (
    <div className="sezioni">
      <Titolo sopra="Società">Documenti</Titolo>

      {/* --------------------------------------------- documenti atleti */}
      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <Etichetta>Documenti degli atleti</Etichetta>
          <div className="flex gap-1 rounded-full vetro orlo p-1">
            {tipiDocumento().map(t => (
              <button
                key={t.key}
                onClick={() => setTipo(t.key)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all',
                  tipo === t.key
                    ? 'vivo text-white'
                    : 'text-tenue hover:text-testo'
                )}
              >
                {t.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {!documenti ? (
          <Scheletro righe={4} />
        ) : rosa.length === 0 ? (
          <Vuoto>Nessun atleta in questa categoria.</Vuoto>
        ) : (
          <>
            {mancanti > 0 && (
              <p className="mb-2.5 text-[12.5px] text-rosso">
                {mancanti} {mancanti === 1 ? 'atleta non è in regola' : 'atleti non sono in regola'} e
                non {mancanti === 1 ? 'può' : 'possono'} scendere in campo.
              </p>
            )}
            {righe.length > 8 && (
              <Cerca
                valore={cerca}
                onCambia={setCerca}
                segnaposto="Cerca un atleta"
                className="mb-2.5 w-full sm:max-w-xs"
              />
            )}

            {visibili.length === 0 ? <NessunRisultato cosa="Nessun atleta" ago={cerca} /> : (
            <Pannello className="overflow-hidden">
              {visibili.map((r, i) => (
                <div
                  key={r.p.id}
                  onClick={() => setScheda(r.p.id)}
                  className={cx('flex cursor-pointer items-center gap-3.5 px-4 py-3 transition-colors hover:bg-pannello/8 sm:px-5',
                    i > 0 && 'border-t border-bordo/6')}
                >
                  <span className="w-7 shrink-0 text-right text-[13px] text-tenue">{r.p.number}</span>
                  <Avatar nome={r.p.name} dim={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold leading-tight">{r.p.name}</div>
                    <div className="text-[12.5px] text-tenue">
                      {r.doc && r.doc.expires_at
                        ? (r.doc.expires_at < oggi ? 'scaduto il ' : 'valido fino al ')
                          + new Date(r.doc.expires_at + 'T00:00:00').toLocaleDateString('it-IT')
                        : r.stato === 'mancante' ? 'mai caricato' : 'senza scadenza'}
                    </div>
                  </div>
                  <Stato tono={TONO[r.stato]}>{DOC_STATE[r.stato].label}</Stato>
                  {r.doc && r.doc.file_path && (
                    <Pulsante
                      className="shrink-0 py-1.5 text-[12.5px]"
                      onClick={async (ev) => {
                        ev.stopPropagation();
                        try {
                          const url = await getDocumentSignedUrl(r.doc.file_path);
                          window.open(url, '_blank', 'noopener');
                        } catch (e) {
                          avvisa((e && e.message) || 'Non è stato possibile aprire il file.', 'errore');
                        }
                      }}
                    >
                      Apri
                    </Pulsante>
                  )}
                </div>
              ))}
            </Pannello>
            )}
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
              Tocca una riga per aprire la scheda dell’atleta: da lì si carica un documento e,
              se ne hai il permesso, lo si approva o si respinge. I moduli precompilati da far
              firmare sono ancora sull’app attuale.
            </p>
          </>
        )}
      </div>

      {/* ------------------------------------------------ esportazioni */}
      <div>
        <Etichetta className="mb-2.5">Porta via i dati</Etichetta>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPORTS.map(e => (
            <Pannello key={e.key} className="pad-pannello-stretto">
              <div className="flex items-start gap-3">
                <IconaSezione id="documenti" dim={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-tight">{e.label}</div>
                  <p className="mt-1 text-[12.5px] leading-snug text-tenue">{e.hint}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Pulsante
                  className="py-1.5 text-[12.5px]"
                  onClick={async () => {
                    if (inCampione()) { avvisa('Nell’anteprima con dati di esempio non c’è niente da esportare.'); return; }
                    try { avvisa((await e.run()) || 'File scaricato'); }
                    catch (err) {
                      console.error(err);
                      avvisa((err && err.message) || 'Esportazione non riuscita.', 'errore');
                    }
                  }}
                >
                  Scarica CSV <Chevron dim={13} />
                </Pulsante>
              </div>
            </Pannello>
          ))}
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-tenue">
          Sono file CSV: si aprono con qualunque foglio di calcolo. Servono a portare via i dati,
          non a rimettere in piedi il sistema — per quello ci vuole un backup vero.
        </p>
      </div>

      {isAdmin(state.currentUser) && (
        <Pannello className="pad-pannello-stretto">
          <Etichetta>Dati personali di un atleta</Etichetta>
          <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">
            Da qui si risponde a una richiesta di accesso ai dati, scaricando tutto ciò che
            l’app conserva su una persona, oppure a una richiesta di cancellazione.
          </p>
          <div className="mt-3 flex justify-end">
            <Pulsante className="py-1.5 text-[12.5px]" onClick={() => setCancella(true)}>
              Apri
            </Pulsante>
          </div>
        </Pannello>
      )}

      {scheda && <SchedaAtleta playerId={scheda} onChiudi={() => setScheda(null)} />}

      {cancella && <Cancellazione onChiudi={() => setCancella(false)} />}
    </div>
  );
}
