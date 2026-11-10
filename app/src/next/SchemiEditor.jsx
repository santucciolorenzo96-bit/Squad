import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { state } from '../state.js';
import { savePlay, deletePlay } from '../api/plays.js';
import {
  LIMITI, TIPI_MOSSA, NOMI_RITARDO, NOMI_DURATA, ID_ATTACCO,
  schemaVuoto, normalizzaSchema, sequenza, conSequenza, statoDopo, pallaDelPasso, puntoPalla, frecce,
  spostaGiocatore, impostaMossa, togliMossa, impostaPalla, impostaPasso,
  conPasso, senzaPasso, spostaPasso, duplicaPasso,
  haLaDifesa, conDifesa, senzaDifesa, ciSonoMosseDifesa,
  conVariante, senzaVariante, aggiornaVariante, nuovoId,
  etichetteUniche, problemiDiPubblicazione
} from '../utils/schemi.js';
import { SchemiCampo } from './SchemiCampo.jsx';
import { SchemaLettore } from './SchemiLettore.jsx';
import { Pulsante, Stato, Etichetta, Pannello, cx } from './ui.jsx';
import { Campo, Testo, Spunta, Interruttore, Conferma, useAvviso } from './moduli.jsx';
import { inCampione } from './campione.js';

/* L'EDITOR DEGLI SCHEMI.
 *
 * Si lavora per passi. «Inizio» e` la posizione di partenza; ogni passo dopo
 * registra solo dove ARRIVA chi si muove, e chi non viene toccato resta dov'era.
 * Si trascina un giocatore, e basta: la freccia si disegna da sola, dal punto
 * in cui era alla fine del passo prima fino a dove lo si e` lasciato.
 *
 * PER IL DITO. L'allenatore lo usera` da tablet e da telefono, in palestra. Quindi:
 *   — l'area sensibile di un giocatore e` piu` larga del suo cerchio;
 *   — nessuna scelta richiede di scrivere un numero: tipo, tempi e durata sono
 *     tre pulsanti, non un campo in millisecondi;
 *   — il campo sta in alto e i comandi del giocatore toccato subito sotto, cosi`
 *     non si scorre per cambiare un movimento che si sta guardando.
 *
 * Ogni modifica passa da una funzione pura di `utils/schemi.js` e restituisce un
 * schema nuovo: qui non si muta niente a meta`.
 */

const VUOTO = { movimenti: [], passaggio: null };

function Sezione({ titolo, aiuto, children }) {
  return (
    <div>
      <Etichetta className="mb-2">{titolo}</Etichetta>
      {children}
      {aiuto && <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">{aiuto}</p>}
    </div>
  );
}

function Pastiglia({ attiva, onClick, children, piccola, disabled, titolo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titolo}
      aria-pressed={attiva}
      className={cx(
        'whitespace-nowrap rounded-full transition-all duration-150 disabled:opacity-35',
        piccola ? 'px-3 py-1.5 text-[12.5px]' : 'px-3.5 py-2 text-[13px]',
        attiva ? 'vivo font-bold text-white' : 'vetro orlo font-semibold text-soffuso hover:text-testo'
      )}
    >
      {children}
    </button>
  );
}

/* Le etichette: libere, con i suggerimenti di quelle gia` in uso. Una lista
 * chiusa costringerebbe a decidere in anticipo come si chiamano le cose; una
 * libera senza suggerimenti produce «Rimessa», «rimesse» e «RIMESSA». */
function EditorEtichette({ valore, suggerite, onCambia }) {
  const [testo, setTesto] = useState('');

  function aggiungi(grezza) {
    const nuove = etichetteUniche([...valore, ...String(grezza).split(',')]);
    onCambia(nuove);
    setTesto('');
  }

  const consigliate = suggerite
    .filter(s => !valore.some(v => v.toLowerCase() === s.toLowerCase()))
    .slice(0, 10);

  return (
    <div>
      {valore.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {valore.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => onCambia(valore.filter(x => x !== e))}
              aria-label={'Togli ' + e}
              className="inline-flex items-center gap-1.5 rounded-full bg-pannello/14 px-2.5 py-1 text-[12.5px] font-semibold text-soffuso transition-colors hover:bg-rosso/14 hover:text-rosso"
            >
              {e} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Testo
          value={testo}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (testo.trim()) aggiungi(testo); }
          }}
          placeholder={valore.length >= LIMITI.etichette ? 'Massimo ' + LIMITI.etichette : 'Es. Rimessa, Attacco, Zona…'}
          maxLength={LIMITI.lunghezzaEtichetta}
          disabled={valore.length >= LIMITI.etichette}
        />
        <Pulsante className="shrink-0" onClick={() => testo.trim() && aggiungi(testo)} disabled={!testo.trim()}>
          Aggiungi
        </Pulsante>
      </div>

      {consigliate.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-tenue">Già in uso:</span>
          {consigliate.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => aggiungi(e)}
              disabled={valore.length >= LIMITI.etichette}
              className="rounded-full border border-dashed border-bordo/25 px-2.5 py-1 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo disabled:opacity-35"
            >
              + {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaEditor({ play, sectorId, etichetteInUso = [], onChiudi, onSalvato, onEliminato }) {
  const avvisa = useAvviso();
  const [id, setId] = useState(play ? play.id : null);
  const [titolo, setTitolo] = useState(play ? play.title : '');
  const [etichette, setEtichette] = useState(play ? etichetteUniche(play.labels) : []);
  const [nota, setNota] = useState(play ? play.note || '' : '');
  const [schema, setSchema] = useState(() => (play ? normalizzaSchema(play.data) : schemaVuoto()));
  const [pubblicato, setPubblicato] = useState(play ? play.status === 'published' : false);
  const [sel, setSel] = useState({ variante: null, passo: -1, giocatore: null });

  const [avvisaAtleti, setAvvisaAtleti] = useState(!(play && play.status === 'published'));
  const [sporco, setSporco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errori, setErrori] = useState([]);
  const [anteprima, setAnteprima] = useState(false);
  const [conferma, setConferma] = useState(null);

  const steps = sequenza(schema, sel.variante);
  // Se si elimina il passo selezionato, la selezione non puo` restare dopo la fine.
  const k = Math.min(sel.passo, steps.length - 1);
  const variante = sel.variante ? schema.varianti.find(v => v.id === sel.variante) : null;
  const difesa = haLaDifesa(schema);

  const dopo = useMemo(() => statoDopo(schema.start, steps, k + 1), [schema.start, steps, k]);
  const prima = useMemo(() => (k >= 0 ? statoDopo(schema.start, steps, k) : null), [schema.start, steps, k]);
  const fr = useMemo(() => (k >= 0 ? frecce(schema.start, steps, k) : VUOTO), [schema.start, steps, k]);
  const fantasmi = prima ? Object.fromEntries(fr.movimenti.map(m => [m.id, prima.pos[m.id]])) : null;
  const palla = puntoPalla(dopo.pos, dopo.palla);

  const passo = k >= 0 ? steps[k] : null;
  const giocatore = sel.giocatore && dopo.pos[sel.giocatore] ? sel.giocatore : null;
  const mossa = passo && giocatore ? passo.moves[giocatore] : null;
  const cambioPalla = k >= 0 ? pallaDelPasso(schema.start, steps, k) : null;
  const passaggioInPasso = cambioPalla && cambioPalla.prima && cambioPalla.dopo && cambioPalla.prima !== cambioPalla.dopo;

  /* Ogni modifica passa da qui: aggiorna lo schema e segna che c'e` qualcosa da
     salvare. */
  function aggiorna(fn) {
    setSchema(prec => fn(prec));
    setSporco(true);
    setErrori([]);
  }

  function modificaSequenza(fn) {
    aggiorna(prec => {
      const st = sequenza(prec, sel.variante);
      const r = fn(prec.start, st);
      return conSequenza({ ...prec, start: r.start || prec.start }, sel.variante, r.steps || st);
    });
  }

  /* ----------------------------------------------------------- campo */
  function sposta(chi, x, y) {
    modificaSequenza((start, st) => spostaGiocatore(start, st, k, chi, x, y));
  }

  /* ----------------------------------------------------------- passi */
  function vaiAlPasso(i) {
    setSel(s => ({ ...s, passo: i, giocatore: null }));
  }

  function aggiungiPasso() {
    if (steps.length >= LIMITI.passi) { avvisa('Un massimo di ' + LIMITI.passi + ' passi per schema.'); return; }
    modificaSequenza((start, st) => ({ steps: conPasso(st, {}) }));
    setSel(s => ({ ...s, passo: steps.length, giocatore: null }));
  }

  function eliminaPasso() {
    if (k < 0) return;
    modificaSequenza((start, st) => ({ steps: senzaPasso(st, k) }));
    setSel(s => ({ ...s, passo: Math.min(k, steps.length - 2), giocatore: null }));
  }

  function muoviPasso(verso) {
    const a = k + verso;
    if (k < 0 || a < 0 || a >= steps.length) return;
    modificaSequenza((start, st) => ({ steps: spostaPasso(st, k, a) }));
    setSel(s => ({ ...s, passo: a }));
  }

  function duplica() {
    if (k < 0) return;
    modificaSequenza((start, st) => ({ steps: duplicaPasso(st, k) }));
    setSel(s => ({ ...s, passo: k + 1, giocatore: null }));
  }

  /* ------------------------------------------------------- giocatore */
  function cambiaMossa(patch) {
    modificaSequenza((start, st) => ({ steps: impostaMossa(st, k, giocatore, patch) }));
  }

  function nonSiMuove() {
    modificaSequenza((start, st) => ({ steps: togliMossa(st, k, giocatore) }));
  }

  function daLaPalla(a) {
    modificaSequenza((start, st) => impostaPalla(start, st, k, a));
  }

  /* ---------------------------------------------------------- difesa */
  function accendiSpegniDifesa() {
    if (!difesa) { aggiorna(prec => conDifesa(prec)); return; }
    if (ciSonoMosseDifesa(schema)) {
      setConferma({
        titolo: 'Togliere la difesa?',
        testo: 'I movimenti dei difensori, in questo schema e nelle varianti, vengono cancellati.',
        etichetta: 'Togli',
        azione: () => aggiorna(prec => senzaDifesa(prec))
      });
      return;
    }
    aggiorna(prec => senzaDifesa(prec));
  }

  /* -------------------------------------------------------- varianti */
  function nuovaVariante() {
    const r = conVariante(schema, '');
    if (!r.id) { avvisa('Un massimo di ' + LIMITI.varianti + ' varianti.'); return; }
    setSchema(r.schema);
    setSporco(true);
    setSel({ variante: r.id, passo: -1, giocatore: null });
  }

  function partiDallaBase() {
    modificaSequenza(() => ({
      steps: schema.steps.map(p => ({ ...p, id: nuovoId('p'), moves: JSON.parse(JSON.stringify(p.moves || {})) }))
    }));
  }

  /* ---------------------------------------------------------- salvare */
  async function salva({ pubblica }) {
    const problemi = [];
    if (!titolo.trim()) problemi.push('Dai un nome allo schema.');
    if (pubblica) {
      problemiDiPubblicazione({ titolo, schema }).forEach(p => { if (!problemi.includes(p)) problemi.push(p); });
    }
    if (problemi.length) { setErrori(problemi); return; }
    if (inCampione()) { setErrori(['Nell’anteprima con dati di esempio non si salva niente.']); return; }

    setSalvando(true);
    setErrori([]);
    try {
      const riga = await savePlay({
        id,
        teamId: state.teamProfile && state.teamProfile.id,
        sectorId,
        titolo,
        etichette: etichetteUniche(etichette),
        nota,
        data: normalizzaSchema(schema),
        pubblicato: pubblica,
        notifica: pubblica && avvisaAtleti
      });
      setId(riga.id);
      setPubblicato(riga.status === 'published');
      setSporco(false);
      if (pubblica && avvisaAtleti) avvisa('Pubblicato: gli atleti sono stati avvisati');
      else avvisa(pubblica ? 'Pubblicato' : 'Salvato come bozza');
      if (onSalvato) onSalvato(riga);
    } catch (e) {
      console.error(e);
      setErrori([(e && e.message) || 'Non è stato possibile salvare lo schema.']);
    } finally {
      setSalvando(false);
    }
  }

  function chiudi() {
    if (!sporco) { onChiudi(); return; }
    setConferma({
      titolo: 'Uscire senza salvare?',
      testo: 'Le modifiche fatte dopo l’ultimo salvataggio vanno perse.',
      etichetta: 'Esci',
      azione: () => onChiudi()
    });
  }

  /* ------------------------------------------------------- disegno */
  const bozzaPerAnteprima = { title: titolo || 'Senza nome', labels: etichette, note: nota, data: schema };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-fondo">
      <div className="margine-notch shrink-0 border-b border-bordo/10 vetro-alto">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={chiudi}
            className="-ml-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-soffuso transition-colors hover:text-testo"
          >
            ← Chiudi
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="truncate text-[15px] font-bold">{id ? 'Modifica schema' : 'Nuovo schema'}</span>
            <Stato tono={pubblicato ? 'buono' : 'neutro'}>{pubblicato ? 'Pubblicato' : 'Bozza'}</Stato>
          </div>
          <Pulsante className="py-1.5 text-[12.5px]" onClick={() => setAnteprima(true)}>Anteprima</Pulsante>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[72rem] px-4 pb-8 pt-4 sm:px-6">
          <Campo etichetta="Nome dello schema">
            <Testo
              value={titolo}
              onChange={e => { setTitolo(e.target.value); setSporco(true); setErrori([]); }}
              maxLength={LIMITI.titolo}
              placeholder="Es. Rimessa laterale 1, Flex, Uscita dalla zona…"
            />
          </Campo>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {/* ===================================================== colonna del campo */}
            <div className="min-w-0 space-y-4">
              {/* Le varianti: lo schema base e le sue alternative. */}
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                <div className="flex w-max items-center gap-1.5">
                  {[{ id: null, nome: 'Schema base' }, ...schema.varianti].map(v => (
                    <Pastiglia
                      key={v.id || 'base'}
                      attiva={v.id === sel.variante}
                      onClick={() => setSel({ variante: v.id, passo: -1, giocatore: null })}
                    >
                      {v.nome}
                    </Pastiglia>
                  ))}
                  <button
                    type="button"
                    onClick={nuovaVariante}
                    className="whitespace-nowrap rounded-full border border-dashed border-bordo/30 px-3.5 py-2 text-[13px] font-semibold text-tenue transition-colors hover:text-testo"
                  >
                    + Variante
                  </button>
                </div>
              </div>

              {variante && (
                <Pannello className="pad-pannello-stretto space-y-3">
                  <Campo etichetta="Nome della variante">
                    <Testo
                      value={variante.nome}
                      maxLength={40}
                      onChange={e => aggiorna(prec => aggiornaVariante(prec, variante.id, { nome: e.target.value }))}
                    />
                  </Campo>
                  <Campo
                    etichetta="Quando si usa"
                    aiuto="La condizione che la fa scegliere: gli atleti la leggono sopra il campo."
                  >
                    <Testo
                      value={variante.condizione}
                      maxLength={LIMITI.condizione}
                      placeholder="Es. Se il difensore del 4 va sopra il blocco"
                      onChange={e => aggiorna(prec => aggiornaVariante(prec, variante.id, { condizione: e.target.value }))}
                    />
                  </Campo>
                  <div className="flex flex-wrap gap-2">
                    {variante.steps.length === 0 && schema.steps.length > 0 && (
                      <Pulsante className="py-1.5 text-[12.5px]" onClick={partiDallaBase}>
                        Parti dai passi dello schema base
                      </Pulsante>
                    )}
                    <Pulsante
                      variante="nudo"
                      className="py-1.5 text-[12.5px] text-rosso"
                      onClick={() => setConferma({
                        titolo: 'Eliminare la variante?',
                        testo: '«' + variante.nome + '» e i suoi passi vengono cancellati.',
                        etichetta: 'Elimina',
                        azione: () => {
                          aggiorna(prec => senzaVariante(prec, variante.id));
                          setSel({ variante: null, passo: -1, giocatore: null });
                        }
                      })}
                    >
                      Elimina la variante
                    </Pulsante>
                  </div>
                </Pannello>
              )}

              {/* I passi. */}
              <div>
                <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                  <div className="flex w-max items-center gap-1.5">
                    {[-1, ...steps.map((_, i) => i)].map(i => (
                      <Pastiglia key={i} piccola attiva={i === k} onClick={() => vaiAlPasso(i)}>
                        <span className="cifra">{i < 0 ? 'Inizio' : i + 1}</span>
                      </Pastiglia>
                    ))}
                    <button
                      type="button"
                      onClick={aggiungiPasso}
                      className="whitespace-nowrap rounded-full border border-dashed border-bordo/30 px-3.5 py-1.5 text-[12.5px] font-semibold text-tenue transition-colors hover:text-testo"
                    >
                      + Passo
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">
                  {k < 0
                    ? 'Questa è la posizione di partenza: trascina i giocatori dove cominciano. Poi aggiungi i passi.'
                    : 'Passo ' + (k + 1) + ': trascina chi si muove dove deve arrivare. Chi non tocchi resta fermo.'}
                  {sel.variante && k < 0 && ' La partenza è la stessa dello schema base.'}
                </p>
              </div>

              {/* Il campo. */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Spunta etichetta="Mostra la difesa" checked={difesa} onChange={accendiSpegniDifesa} />
                  <span className="text-[12px] text-tenue">
                    {passo && passo.moves && Object.keys(passo.moves).length > 0
                      ? Object.keys(passo.moves).length + (Object.keys(passo.moves).length === 1 ? ' si muove' : ' si muovono')
                      : ''}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl orlo">
                  <SchemiCampo
                    pos={dopo.pos}
                    palla={palla}
                    movimenti={fr.movimenti}
                    passaggio={fr.passaggio}
                    fantasmi={fantasmi}
                    selezionato={giocatore}
                    interattivo
                    onSeleziona={chi => setSel(s => ({ ...s, giocatore: chi }))}
                    onSposta={sposta}
                  />
                </div>
              </div>

              {/* Il giocatore toccato. */}
              <Pannello className="pad-pannello-stretto">
                {!giocatore ? (
                  <p className="text-[13px] leading-relaxed text-tenue">
                    Tocca un giocatore per scegliere come si muove e chi ha la palla.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[14px] font-bold">
                        {giocatore.startsWith('d') ? 'Difensore ' : 'Giocatore '}{giocatore.slice(1)}
                        {dopo.palla === giocatore && <span className="ml-2 text-[12.5px] font-semibold text-ambra">ha la palla</span>}
                      </div>
                      {mossa && (
                        <Pulsante variante="nudo" className="py-1 text-[12.5px]" onClick={nonSiMuove}>
                          Non si muove
                        </Pulsante>
                      )}
                    </div>

                    {k < 0 && (
                      <p className="text-[12.5px] text-tenue">Trascinalo dov’è all’inizio.</p>
                    )}

                    {k >= 0 && !mossa && (
                      <p className="text-[12.5px] leading-relaxed text-tenue">
                        In questo passo resta fermo. Trascinalo per farlo muovere.
                      </p>
                    )}

                    {mossa && (
                      <>
                        <Sezione titolo="Come si muove">
                          <Interruttore
                            valore={mossa.tipo}
                            onCambia={tipo => cambiaMossa({ tipo })}
                            voci={Object.keys(TIPI_MOSSA).map(t => ({ id: t, testo: TIPI_MOSSA[t] }))}
                          />
                        </Sezione>
                        <Sezione
                          titolo="Quando parte"
                          aiuto="Arriva comunque alla fine del passo: chi parte più tardi si muove più in fretta."
                        >
                          <Interruttore
                            valore={mossa.parte}
                            onCambia={parte => cambiaMossa({ parte })}
                            voci={Object.keys(NOMI_RITARDO).map(t => ({ id: t, testo: NOMI_RITARDO[t] }))}
                          />
                        </Sezione>
                      </>
                    )}

                    {ID_ATTACCO.includes(giocatore) && (
                      <Sezione titolo="La palla">
                        <div className="flex flex-wrap gap-2">
                          <Pastiglia
                            piccola
                            attiva={dopo.palla === giocatore}
                            onClick={() => daLaPalla(giocatore)}
                          >
                            {k < 0 ? 'Parte con la palla' : 'Riceve la palla'}
                          </Pastiglia>
                          {k >= 0 && (
                            <Pastiglia piccola attiva={dopo.palla === 'canestro'} onClick={() => daLaPalla('canestro')}>
                              Tira a canestro
                            </Pastiglia>
                          )}
                        </div>
                      </Sezione>
                    )}
                  </div>
                )}
              </Pannello>
            </div>

            {/* ================================================ colonna delle impostazioni */}
            <div className="min-w-0 space-y-5">
              {passo ? (
                <Pannello className="pad-pannello-stretto space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Etichetta>Passo {k + 1} di {steps.length}</Etichetta>
                    <div className="flex items-center gap-1">
                      <Pulsante variante="nudo" className="px-2.5 py-1 text-[12.5px]" onClick={() => muoviPasso(-1)} disabled={k === 0} title="Sposta prima">←</Pulsante>
                      <Pulsante variante="nudo" className="px-2.5 py-1 text-[12.5px]" onClick={() => muoviPasso(1)} disabled={k >= steps.length - 1} title="Sposta dopo">→</Pulsante>
                      <Pulsante variante="nudo" className="px-2.5 py-1 text-[12.5px]" onClick={duplica}>Duplica</Pulsante>
                      <Pulsante variante="nudo" className="px-2.5 py-1 text-[12.5px] text-rosso" onClick={eliminaPasso}>Elimina</Pulsante>
                    </div>
                  </div>

                  <Campo etichetta="Cosa succede" aiuto="Lo leggono gli atleti sotto il campo mentre l’animazione corre.">
                    <Testo
                      value={passo.nota}
                      maxLength={LIMITI.nota}
                      placeholder="Es. Il 1 passa al 4 e va a bloccare per il 2"
                      onChange={e => modificaSequenza((start, st) => ({ steps: impostaPasso(st, k, { nota: e.target.value }) }))}
                    />
                  </Campo>

                  <Sezione titolo="Durata del passo">
                    <Interruttore
                      valore={passo.dur}
                      onCambia={dur => modificaSequenza((start, st) => ({ steps: impostaPasso(st, k, { dur }) }))}
                      voci={Object.keys(NOMI_DURATA).map(t => ({ id: t, testo: NOMI_DURATA[t] }))}
                    />
                  </Sezione>

                  {passaggioInPasso && (
                    <Sezione
                      titolo={cambioPalla.dopo === 'canestro'
                        ? 'Quando tira'
                        : 'Quando passa'}
                    >
                      <Interruttore
                        valore={passo.ritardoPalla || 'subito'}
                        onCambia={ritardoPalla => modificaSequenza((start, st) => ({ steps: impostaPasso(st, k, { ritardoPalla }) }))}
                        voci={Object.keys(NOMI_RITARDO).map(t => ({ id: t, testo: NOMI_RITARDO[t] }))}
                      />
                    </Sezione>
                  )}
                </Pannello>
              ) : (
                <Pannello className="pad-pannello-stretto">
                  <p className="text-[13px] leading-relaxed text-tenue">
                    {steps.length === 0
                      ? 'Dopo aver sistemato la partenza, tocca «+ Passo» per aggiungere il primo movimento.'
                      : 'Scegli un passo per cambiarne la durata e la didascalia.'}
                  </p>
                </Pannello>
              )}

              <Sezione titolo="Etichette" aiuto="Servono a ritrovare gli schemi: si filtra per etichetta, e se ne possono mettere più d’una.">
                <EditorEtichette
                  valore={etichette}
                  suggerite={etichetteInUso}
                  onCambia={e => { setEtichette(e); setSporco(true); }}
                />
              </Sezione>

              <Campo etichetta="Note per gli atleti (facoltative)">
                <textarea
                  value={nota}
                  onChange={e => { setNota(e.target.value); setSporco(true); }}
                  maxLength={600}
                  rows={4}
                  placeholder="A cosa fare attenzione, quando usarlo, cosa chiede l’allenatore…"
                  className="w-full rounded-lg vetro orlo px-3.5 py-2.5 text-[14px] leading-relaxed text-testo transition-colors placeholder:text-tenue focus:border-blu/60 focus:outline-none"
                />
              </Campo>
            </div>
          </div>
        </div>
      </div>

      {/* Il pie` della schermata: sempre a portata di pollice. */}
      <div className="shrink-0 border-t border-bordo/10 vetro-alto pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[72rem] px-4 py-3 sm:px-6">
          {errori.length > 0 && (
            <div className="mb-2.5 space-y-1 rounded-lg bg-rosso/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-rosso">
              {errori.map(e => <p key={e}>{e}</p>)}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <div className="min-w-0">
              <Spunta
                etichetta={pubblicato ? 'Avvisa gli atleti dell’aggiornamento' : 'Avvisa gli atleti quando lo pubblico'}
                checked={avvisaAtleti}
                onChange={e => setAvvisaAtleti(e.target.checked)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {id && (
                <Pulsante
                  variante="nudo"
                  className="py-2 text-[13px] text-rosso"
                  disabled={salvando}
                  onClick={() => setConferma({
                    titolo: 'Eliminare lo schema?',
                    testo: '«' + (titolo || 'Senza nome') + '» sparisce per tutti, anche per gli atleti. Non si può annullare.',
                    etichetta: 'Elimina',
                    azione: async () => {
                      await deletePlay(id);
                      avvisa('Schema eliminato');
                      if (onEliminato) onEliminato(id);
                    }
                  })}
                >
                  Elimina
                </Pulsante>
              )}
              {pubblicato ? (
                <>
                  <Pulsante className="py-2 text-[13px]" disabled={salvando} onClick={() => salva({ pubblica: false })}>
                    Rimetti in bozza
                  </Pulsante>
                  <Pulsante variante="primario" className="py-2 text-[13px]" disabled={salvando} onClick={() => salva({ pubblica: true })}>
                    {salvando ? 'Salvo…' : 'Salva le modifiche'}
                  </Pulsante>
                </>
              ) : (
                <>
                  <Pulsante className="py-2 text-[13px]" disabled={salvando} onClick={() => salva({ pubblica: false })}>
                    {salvando ? 'Salvo…' : 'Salva bozza'}
                  </Pulsante>
                  <Pulsante variante="primario" className="py-2 text-[13px]" disabled={salvando} onClick={() => salva({ pubblica: true })}>
                    Pubblica
                  </Pulsante>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {anteprima && (
        <SchemaLettore play={bozzaPerAnteprima} anteprima onChiudi={() => setAnteprima(false)} />
      )}

      {conferma && (
        <Conferma
          titolo={conferma.titolo}
          testo={conferma.testo}
          etichetta={conferma.etichetta}
          onChiudi={() => setConferma(null)}
          onConferma={conferma.azione}
        />
      )}
    </div>,
    document.body
  );
}

