import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { contiene } from '../utils/format.js';
import { tipiDocumento } from '../utils/sports/index.js';
import { fetchPlayerPhotoUrls, fetchDocumentsForPlayers, addPlayer, updatePlayer } from '../api/roster.js';
import { senzaNumero, normalizzaNumero, numeriOccupati, doppioniNelModulo } from '../utils/maglie.js';
import { canEditRoster, managesSector } from '../utils/permissions.js';
import { docStatus, worstStatus, ageFrom, DOC_STATE } from '../utils/docStatus.js';
import { inCampione, DOCUMENTI_CAMPIONE } from './campione.js';
import { Pannello, Etichetta, Stato, Dato, Vuoto, Scheletro, Avatar, Pulsante, Titolo, Cerca, NessunRisultato, cx } from './ui.jsx';
import { Modulo, Campo, Testo, useAvviso } from './moduli.jsx';
import { IconaSezione, Chevron } from './icone.jsx';
import { SchedaAtleta } from './SchedaAtleta.jsx';
import { oggiISO } from '../utils/format.js';

/* L'anagrafica.
 *
 * La domanda è sempre la stessa: chi non è a posto. Quindi non è un elenco di
 * nomi da aprire uno per uno — chi non è in regola sta in cima, con lo stato
 * scritto sulla riga.
 *
 * Un giocatore NUOVO si crea qui, non dalla Rosa. La Rosa dice chi gioca,
 * l'Anagrafica dice chi esiste: creare una persona dalla schermata in cui si
 * dispone la formazione confondeva due cose diverse, e portava a crearla
 * proprio dove non se ne vedono i dati.
 *
 * Su schermo stretto la tabella non diventa una tabella che scorre di lato:
 * diventa schede. Scorrere in orizzontale per scoprire che un certificato è
 * scaduto non è leggere.
 */

const TONO = { ok: 'buono', scadenza: 'attesa', verifica: 'attesa', scaduto: 'fermo', respinto: 'fermo', mancante: 'fermo' };
const BREVE = { certificato_medico: 'Certificato', tesseramento_fip: 'Tesseramento' };


export function Anagrafica() {
  const [caricato, setCaricato] = useState(false);
  const [foto, setFoto] = useState({});
  const [documenti, setDocumenti] = useState({});
  const [soloProblemi, setSoloProblemi] = useState(false);
  const [cerca, setCerca] = useState('');
  const [nuovo, setNuovo] = useState(false);
  const [numeri, setNumeri] = useState(false);
  const [scheda, setScheda] = useState(null);
  const [, ridisegna] = useState(0);
  const avvisa = useAvviso();

  const puoiModificare = canEditRoster(state.currentUser) && managesSector(state.currentUser, state.activeSectorId, state.staffSectors);
  const rosa = state.roster;

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    const ids = rosa.map(p => p.id);
    if (ids.length === 0) { setCaricato(true); return; }
    if (inCampione()) { setDocumenti(DOCUMENTI_CAMPIONE); setCaricato(true); return; }
    // Le due richieste sono indipendenti: in sequenza raddoppierebbero
    // l'attesa davanti a una tabella vuota.
    Promise.all([
      fetchPlayerPhotoUrls(rosa).catch(() => ({})),
      fetchDocumentsForPlayers(ids).catch(() => ({}))
    ]).then(([f, d]) => {
      if (!vivo) return;
      setFoto(f); setDocumenti(d); setCaricato(true);
    });
    return () => { vivo = false; };
  }, [rosa]);

  const oggi = oggiISO();
  const righe = rosa.map(p => {
    const suoi = documenti[p.id] || [];
    const stati = {};
    tipiDocumento().forEach(t => { stati[t.key] = docStatus(suoi.filter(d => d.doc_type === t.key), oggi); });
    return { p, stati, peggiore: worstStatus(Object.values(stati)), eta: ageFrom(p.birth_date, oggi) };
  }).sort((a, b) => (DOC_STATE[b.peggiore].rank - DOC_STATE[a.peggiore].rank) || a.p.name.localeCompare(b.p.name));

  const fermi = righe.filter(r => DOC_STATE[r.peggiore].tone === 'bad');
  const daSeguire = righe.filter(r => DOC_STATE[r.peggiore].tone === 'warn');
  const aPosto = righe.length - fermi.length - daSeguire.length;
  // Il registro di una societa' vera e' lungo: la ricerca non e' un di piu', e'
  // il modo normale di arrivare a una persona. Nome e numero insieme, perche' in
  // palestra un atleta si chiama tanto col nome quanto col numero.
  const senzaIlNumero = rosa.filter(senzaNumero);
  const perNome = righe.filter(r => contiene(r.p.name + ' ' + (r.p.number || ''), cerca));
  const visibili = soloProblemi ? perNome.filter(r => DOC_STATE[r.peggiore].tone !== 'ok') : perNome;

  return (
    <div className="sezioni">
      <Titolo
        sopra="Categoria"
        azione={puoiModificare
          ? <Pulsante variante="primario" onClick={() => setNuovo(true)}>+ Atleta</Pulsante>
          : <span className="shrink-0 text-[12.5px] text-tenue">{righe.length} atleti</span>}
      >
        Anagrafica
      </Titolo>

      {righe.length > 0 && (
        <div className="grid grid-cols-2 schede lg:grid-cols-4">
          <Dato etichetta="In rosa" valore={righe.length} icona={<IconaSezione id="rosa" dim={26} />} />
          <Dato
            etichetta="Fermi"
            valore={fermi.length}
            tono={fermi.length ? 'fermo' : undefined}
            sotto={fermi.length ? 'non possono scendere in campo' : 'nessuno fermo'}
          />
          <Dato
            etichetta="Da seguire"
            valore={daSeguire.length}
            tono={daSeguire.length ? 'attesa' : undefined}
            sotto="in scadenza o in verifica"
          />
          <Dato
            etichetta="In regola"
            valore={`${righe.length ? Math.round(aPosto / righe.length * 100) : 0}%`}
            sotto={`${aPosto} su ${righe.length}`}
          />
        </div>
      )}

      {/* Un atleta senza numero non è un errore da segnalare in rosso: è una
          cosa rimasta a metà, e finché resta così nel tabellino e nello scout
          quel ragazzo si distingue solo dal nome. L'avviso compare solo se
          c'è, e sparisce da solo quando i numeri ci sono tutti. */}
      {puoiModificare && senzaIlNumero.length > 0 && (
        <Pannello className="flex flex-wrap items-center justify-between gap-3 pad-pannello-stretto">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold leading-tight">
              {senzaIlNumero.length === 1
                ? 'Un atleta è senza numero di maglia'
                : `${senzaIlNumero.length} atleti sono senza numero di maglia`}
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-tenue">
              Nel tabellino e nello scout si distinguono solo dal nome. Puoi darglielo
              tu, oppure lo sceglie ciascuno dalla propria scheda.
            </p>
          </div>
          <Pulsante className="shrink-0 py-1.5 text-[12.5px]" onClick={() => setNumeri(true)}>
            Assegna i numeri
          </Pulsante>
        </Pannello>
      )}

      {!caricato ? (
        <Scheletro righe={4} />
      ) : righe.length === 0 ? (
        <Vuoto>
          Nessun atleta in questa categoria.
          {puoiModificare && ' Aggiungine uno: bastano numero e nome, il resto si completa dalla sua scheda.'}
        </Vuoto>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Etichetta>Il registro</Etichetta>
            <Cerca
              valore={cerca}
              onCambia={setCerca}
              segnaposto="Cerca un atleta"
              className="order-last w-full sm:order-none sm:w-56"
            />
            {(fermi.length + daSeguire.length) > 0 && (
              <Pulsante
                variante={soloProblemi ? 'primario' : 'vetro'}
                onClick={() => setSoloProblemi(v => !v)}
                className="py-1.5 text-[12.5px]"
              >
                {soloProblemi ? 'Mostra tutti' : `Solo i ${fermi.length + daSeguire.length} da sistemare`}
              </Pulsante>
            )}
          </div>

          {/* Una ricerca che non trova niente deve dirlo con la parola
              cercata dentro: un elenco che sparisce sembra un difetto. */}
          {visibili.length === 0 ? (
            cerca
              ? <NessunRisultato cosa="Nessun atleta" ago={cerca} />
              : <Vuoto>Nessun atleta da sistemare in questa categoria.</Vuoto>
          ) : (
            <>
            {/* ---------------------------------------------- da tablet in su */}
            <Pannello className="hidden overflow-hidden md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-bordo/10">
                    <th className="etichetta px-5 py-3.5">Atleta</th>
                    <th className="etichetta w-16 px-5 py-3.5">Età</th>
                    {tipiDocumento().map(t => (
                      <th key={t.key} className="etichetta px-5 py-3.5">{BREVE[t.key] || t.label}</th>
                    ))}
                    <th className="etichetta px-5 py-3.5">Contatto</th>
                  </tr>
                </thead>
                <tbody>
                  {visibili.map(r => (
                    <tr
                      key={r.p.id}
                      onClick={() => setScheda(r.p.id)}
                      className="cursor-pointer border-b border-bordo/6 transition-colors last:border-b-0 hover:bg-pannello/8"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3.5">
                          {/* Il numero di maglia prima del nome, incolonnato:
                              è come si legge un elenco di squadra. */}
                          <span className="w-7 shrink-0 text-right text-[15px] font-medium text-tenue">
                            {r.p.number}
                          </span>
                          <Avatar nome={r.p.name} url={foto[r.p.id]} dim={34} />
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-semibold leading-tight">{r.p.name}</div>
                            {r.p.role_position && (
                              <div className="text-[12px] text-tenue">{r.p.role_position}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-soffuso">{r.eta == null ? '—' : r.eta}</td>
                      {tipiDocumento().map(t => (
                        <td key={t.key} className="px-5 py-3">
                          <Stato tono={TONO[r.stati[t.key]]}>{DOC_STATE[r.stati[t.key]].label}</Stato>
                        </td>
                      ))}
                      <td className="px-5 py-3 text-[12.5px] text-tenue">
                        {r.p.guardian_phone || r.p.email || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Pannello>

            {/* ------------------------------------------------- su telefono */}
            <div className="space-y-3 md:hidden">
              {visibili.map(r => (
                <Pannello
                  key={r.p.id}
                  onClick={() => setScheda(r.p.id)}
                  className="pad-pannello-stretto relative cursor-pointer overflow-hidden"
                >
                  {/* Il filo colorato a sinistra: dice lo stato prima che si
                      legga qualunque parola. */}
                  {DOC_STATE[r.peggiore].tone !== 'ok' && (
                    <span className={cx('absolute inset-y-0 left-0 w-1',
                      DOC_STATE[r.peggiore].tone === 'bad' ? 'bg-rosso' : 'bg-ambra')} />
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-[15px] font-medium text-tenue">
                      {r.p.number}
                    </span>
                    <Avatar nome={r.p.name} url={foto[r.p.id]} dim={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold leading-tight">{r.p.name}</div>
                      <div className="text-[12.5px] text-tenue">
                        {r.eta != null && <span className="cifra">{r.eta} anni</span>}
                        {r.eta != null && r.p.role_position && ' · '}
                        {r.p.role_position}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2.5 border-t border-bordo/8 pt-3">
                    {tipiDocumento().map(t => (
                      <div key={t.key}>
                        <Etichetta className="mb-1.5">{BREVE[t.key] || t.label}</Etichetta>
                        <Stato tono={TONO[r.stati[t.key]]}>{DOC_STATE[r.stati[t.key]].label}</Stato>
                      </div>
                    ))}
                  </div>
                </Pannello>
              ))}
            </div>
            </>
          )}
        </>
      )}

      {scheda && <SchedaAtleta playerId={scheda} onChiudi={() => { setScheda(null); }} />}

      {numeri && (
        <ModuloNumeri
          senza={senzaIlNumero}
          rosa={rosa}
          onChiudi={() => setNumeri(false)}
          onFatto={(quanti) => {
            ridisegna(n => n + 1);
            avvisa(quanti === 1 ? 'Numero assegnato' : `${quanti} numeri assegnati`);
          }}
        />
      )}

      {nuovo && (
        <ModuloAtleta
          onChiudi={() => setNuovo(false)}
          onFatto={(creato) => {
            state.roster.push(creato);
            ridisegna(n => n + 1);
            avvisa('Atleta aggiunto');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------- tutti i numeri */
/* Undici atleti senza numero volevano dire undici giri dentro «Modifica la
 * scheda», undici volte la stessa apertura e la stessa chiusura. Qui si vedono
 * tutti insieme, con accanto i numeri già presi: assegnarli diventa una cosa
 * sola, e chi lascia una casella vuota semplicemente non decide adesso.
 *
 * Le caselle vuote non sono un errore: si salva quello che c'è.
 */
function ModuloNumeri({ senza, rosa, onChiudi, onFatto }) {
  const [scelte, setScelte] = useState({});
  const presi = numeriOccupati(rosa, senza.map(p => p.id));
  const elenco = Object.keys(presi).sort((a, b) => Number(a) - Number(b));

  return (
    <Modulo
      titolo="I numeri di maglia"
      sotto={senza.length === 1 ? 'Un atleta senza numero' : `${senza.length} atleti senza numero`}
      etichettaInvia="Assegna"
      onChiudi={onChiudi}
      onInvia={async () => {
        const doppi = doppioniNelModulo(scelte);
        const ripetuto = Object.keys(doppi)[0];
        if (ripetuto) return `Il numero ${ripetuto} l'hai scritto due volte.`;

        const daSalvare = [];
        for (const p of senza) {
          const grezzo = (scelte[p.id] || '').trim();
          if (!grezzo) continue;
          const n = normalizzaNumero(grezzo);
          if (!n) return `«${grezzo}» non è un numero di maglia.`;
          if (presi[n]) return `Il numero ${n} ce l'ha già ${presi[n]}.`;
          daSalvare.push({ p, n });
        }
        if (daSalvare.length === 0) return 'Non hai scritto nessun numero.';
        if (inCampione()) return 'Nell’anteprima con dati di esempio non si salva niente.';

        for (const { p, n } of daSalvare) {
          await updatePlayer(p.id, { number: n });
          p.number = n;
        }
        onFatto(daSalvare.length);
      }}
    >
      <div className="space-y-2">
        {senza.map(p => (
          <div key={p.id} className="flex items-center gap-3">
            <Testo
              className="w-16 text-center"
              value={scelte[p.id] || ''}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '');
                setScelte(s => ({ ...s, [p.id]: v }));
              }}
              inputMode="numeric"
              maxLength={3}
              placeholder="—"
            />
            <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name}</span>
          </div>
        ))}
      </div>

      {elenco.length > 0 && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-tenue">
          Già presi in questa categoria:{' '}
          <span className="cifra text-soffuso">{elenco.join(', ')}</span>.
        </p>
      )}
      <p className="text-[12.5px] leading-relaxed text-tenue">
        Le caselle che lasci vuote restano come sono: il numero potrà sceglierlo
        l’atleta dalla propria scheda.
      </p>
    </Modulo>
  );
}

/* ------------------------------------------------------------------ modulo */
function ModuloAtleta({ onChiudi, onFatto }) {
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');

  return (
    <Modulo
      titolo="Nuovo atleta"
      sotto="Bastano numero e nome. Data di nascita, ruolo, contatti e certificato si completano dopo, dalla sua scheda."
      etichettaInvia="Aggiungi"
      onChiudi={onChiudi}
      onInvia={async () => {
        const n = nome.trim();
        if (!n) return 'Scrivi il nome dell’atleta.';
        // Il numero è testo di proposito: "00" esiste, e nel minibasket capita
        // di non averne affatto.
        const creato = await addPlayer(
          state.teamProfile.id, state.activeSectorId,
          numero.trim() || '-', n, state.activeSeasonId
        );
        onFatto(creato);
      }}
    >
      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
        <Campo etichetta="Numero">
          <Testo value={numero} onChange={e => setNumero(e.target.value)} placeholder="7" maxLength={3} />
        </Campo>
        <Campo etichetta="Nome e cognome">
          <Testo value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" autoFocus />
        </Campo>
      </div>
    </Modulo>
  );
}
