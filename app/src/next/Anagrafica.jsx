import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { DOC_TYPES } from '../utils/permissions.js';
import { fetchPlayerPhotoUrls, fetchDocumentsForPlayers } from '../api/roster.js';
import { docStatus, worstStatus, ageFrom, DOC_STATE } from '../utils/docStatus.js';
import { inCampione, DOCUMENTI_CAMPIONE } from './campione.js';
import { Foglio, Etichetta, Stato, Dato, Vuoto, Scheletro, Avatar, Pulsante, cx } from './ui.jsx';

/* L'anagrafica.
 *
 * La domanda è sempre la stessa: chi non è a posto. Quindi non è un elenco di
 * nomi da aprire uno a uno — è un registro, e chi non è in regola sta in cima
 * con un timbro accanto.
 *
 * Su schermo stretto la tabella non diventa una tabella che scorre di lato:
 * diventa un elenco di schede. Scorrere in orizzontale per scoprire che un
 * certificato è scaduto non è leggere.
 */

const TONO = { ok: 'buono', scadenza: 'attesa', verifica: 'attesa', scaduto: 'fermo', respinto: 'fermo', mancante: 'fermo' };
const BREVE = { certificato_medico: 'Certificato', tesseramento_fip: 'Tesseramento' };

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

export function Anagrafica() {
  const [caricato, setCaricato] = useState(false);
  const [foto, setFoto] = useState({});
  const [documenti, setDocumenti] = useState({});
  const [soloProblemi, setSoloProblemi] = useState(false);

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
    DOC_TYPES.forEach(t => { stati[t.key] = docStatus(suoi.filter(d => d.doc_type === t.key), oggi); });
    return { p, stati, peggiore: worstStatus(Object.values(stati)), eta: ageFrom(p.birth_date, oggi) };
  }).sort((a, b) => (DOC_STATE[b.peggiore].rank - DOC_STATE[a.peggiore].rank) || a.p.name.localeCompare(b.p.name));

  const fermi = righe.filter(r => DOC_STATE[r.peggiore].tone === 'bad');
  const daSeguire = righe.filter(r => DOC_STATE[r.peggiore].tone === 'warn');
  const aPosto = righe.length - fermi.length - daSeguire.length;
  const visibili = soloProblemi ? righe.filter(r => DOC_STATE[r.peggiore].tone !== 'ok') : righe;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 border-b-2 riga pb-3">
        <div>
          <Etichetta>Categoria</Etichetta>
          <h1 className="font-serif text-[clamp(24px,5vw,34px)] leading-none">Anagrafica</h1>
        </div>
        <div className="cifra shrink-0 text-[13px] text-grafite">{righe.length} atleti</div>
      </div>

      {righe.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Dato etichetta="In rosa" valore={righe.length} />
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

      {!caricato ? (
        <Scheletro righe={4} />
      ) : righe.length === 0 ? (
        <Vuoto>Nessun atleta in questa categoria. Si aggiungono dalla Rosa.</Vuoto>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <Etichetta>Il registro</Etichetta>
            {(fermi.length + daSeguire.length) > 0 && (
              <Pulsante
                variante={soloProblemi ? 'pieno' : 'vuoto'}
                onClick={() => setSoloProblemi(v => !v)}
                className="py-1 text-[11.5px]"
              >
                {soloProblemi ? 'Mostra tutti' : `Solo i ${fermi.length + daSeguire.length} da sistemare`}
              </Pulsante>
            )}
          </div>

          {/* ---------------------------------------------- da tablet in su */}
          <Foglio className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 riga">
                  <th className="etichetta px-4 py-2.5">Atleta</th>
                  <th className="etichetta px-4 py-2.5 w-16">Età</th>
                  {DOC_TYPES.map(t => (
                    <th key={t.key} className="etichetta px-4 py-2.5">{BREVE[t.key] || t.label}</th>
                  ))}
                  <th className="etichetta px-4 py-2.5">Contatto</th>
                </tr>
              </thead>
              <tbody>
                {visibili.map(r => (
                  <tr key={r.p.id} className="border-b riga last:border-b-0 hover:bg-carta2/70">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Il numero di maglia prima del nome, monospaziato e
                            incolonnato: è come si legge un elenco di squadra. */}
                        <span className="cifra w-7 shrink-0 text-right text-[15px] font-bold text-grafite">
                          {r.p.number}
                        </span>
                        <Avatar nome={r.p.name} url={foto[r.p.id]} dim={30} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold leading-tight">{r.p.name}</div>
                          {r.p.role_position && (
                            <div className="text-[11px] text-grafite">{r.p.role_position}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="cifra px-4 py-2.5 text-[13px]">{r.eta == null ? '—' : r.eta}</td>
                    {DOC_TYPES.map(t => (
                      <td key={t.key} className="px-4 py-2.5">
                        <Stato tono={TONO[r.stati[t.key]]}>{DOC_STATE[r.stati[t.key]].label}</Stato>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-[12.5px] text-grafite">
                      {r.p.guardian_phone || r.p.email || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Foglio>

          {/* ------------------------------------------------- su telefono */}
          <div className="space-y-2.5 md:hidden">
            {visibili.map(r => (
              <Foglio
                key={r.p.id}
                className={cx('px-3 py-3', DOC_STATE[r.peggiore].tone === 'bad' && 'border-l-3 border-l-timbro')}
              >
                <div className="flex items-center gap-3">
                  <span className="cifra w-7 shrink-0 text-right text-[16px] font-bold text-grafite">
                    {r.p.number}
                  </span>
                  <Avatar nome={r.p.name} url={foto[r.p.id]} dim={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold leading-tight">{r.p.name}</div>
                    <div className="text-[11.5px] text-grafite">
                      {r.eta != null && <span className="cifra">{r.eta} anni</span>}
                      {r.eta != null && r.p.role_position && ' · '}
                      {r.p.role_position}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t riga pt-2.5">
                  {DOC_TYPES.map(t => (
                    <div key={t.key}>
                      <div className="etichetta mb-1">{BREVE[t.key] || t.label}</div>
                      <Stato tono={TONO[r.stati[t.key]]}>{DOC_STATE[r.stati[t.key]].label}</Stato>
                    </div>
                  ))}
                </div>
              </Foglio>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
