import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { fetchInvites, createInvite, revokeInvite } from '../api/invites.js';
import { fetchPending } from '../api/profiles.js';
import {
  codiceAttivo, statoCodice, postiRimasti, inAttesaDellaCategoria,
  puoiInvitareNellaCategoria, messaggioDaMandare,
  POSTI_PREDEFINITI, GIORNI_PREDEFINITI
} from '../utils/codiceCategoria.js';
import { ROLES } from '../utils/permissions.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Pulsante, Stato, cx } from './ui.jsx';
import { Conferma, useAvviso } from './moduli.jsx';
import { ModuloIscritto } from './Utenti.jsx';

/* IL CODICE DA MANDARE AGLI ATLETI DELLA CATEGORIA.
 *
 * Fino a oggi far entrare un atleta era cosa da amministratore: l'allenatore
 * sa chi sono i suoi ragazzi, ma per farli entrare doveva chiedere a qualcun
 * altro di creare sette inviti, uno per ragazzo. Nei fatti si finiva col dare
 * a tutti il codice società — uno solo, uguale per tutti, permanente, e chi lo
 * usa dichiara da sé di essere atleta, genitore o staff.
 *
 * Questo codice fa la stessa cosa in meglio: il ruolo è deciso prima e non si
 * dichiara, la categoria è scritta sul codice, scade, e vale per un numero
 * preciso di persone.
 *
 * STA NELLA ROSA, non in Utenti.
 * «Il codice per i miei atleti» è una domanda che viene in mente guardando i
 * propri atleti, e Utenti è una schermata da amministratore. Qui accanto c'è
 * anche chi è entrato con quel codice e aspetta, perché sono la stessa cosa
 * vista a due giorni di distanza: mando il codice, poi guardo chi è arrivato.
 */

function fmtData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function CodiceCategoria() {
  const avvisa = useAvviso();
  const sectorId = state.activeSectorId;
  const settore = (state.sectors || []).find(s => s.id === sectorId) || {};

  const [inviti, setInviti] = useState(null);
  const [attesa, setAttesa] = useState([]);
  const [apri, setApri] = useState(false);
  const [lavora, setLavora] = useState(false);
  const [daRevocare, setDaRevocare] = useState(null);
  const [scelto, setScelto] = useState(null);

  const puoi = puoiInvitareNellaCategoria(state.currentUser, sectorId, state.staffSectors);

  function carica() {
    if (!puoi || inCampione()) { setInviti([]); setAttesa([]); return; }
    fetchInvites().then(setInviti).catch(() => setInviti([]));
    fetchPending().then(setAttesa).catch(() => setAttesa([]));
  }
  useEffect(carica, [sectorId, puoi]);

  if (!puoi) return null;

  const codice = codiceAttivo(inviti, sectorId);
  const aspettano = inAttesaDellaCategoria(attesa, settore.name);

  /* Chi aspetta si vede sempre, il codice solo se c'è o se lo si apre: una
     società che fa tutto dagli inviti nominativi non ha bisogno di questo
     riquadro aperto in cima alla rosa ogni volta. */
  if (inviti === null) return null;
  if (!codice && !apri && aspettano.length === 0) {
    return (
      <button
        onClick={() => setApri(true)}
        className="w-full rounded-xl px-4 py-3 text-left text-[12.5px] font-semibold text-tenue transition-colors orlo vetro hover:text-testo"
      >
        + Un codice da mandare agli atleti di {settore.name || 'questa categoria'}
      </button>
    );
  }

  return (
    <div>
      {aspettano.length > 0 && (
        <div className="mb-3">
          <Etichetta className="mb-2.5">
            {aspettano.length === 1
              ? 'Un atleta è entrato e aspetta che lo confermi'
              : aspettano.length + ' atleti sono entrati e aspettano che li confermi'}
          </Etichetta>
          <Pannello className="overflow-hidden">
            {aspettano.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setScelto(r)}
                className={cx(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-pannello/8 sm:px-5',
                  i > 0 && 'border-t border-bordo/6'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-tight">{r.display_name}</div>
                  <div className="mt-1 text-[12.5px] text-tenue">
                    {ROLES[r.role] || r.role}
                    {r.claim_note ? ' · in rosa come ' + r.claim_note : ' · non ha detto di chi'}
                  </div>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold text-blu">Guarda</span>
              </button>
            ))}
          </Pannello>
          <p className="mt-2 text-[12px] leading-relaxed text-tenue">
            Finché non li confermi non vedono niente: sono entrati, ma trovano una sala d’attesa.
          </p>
        </div>
      )}

      <Etichetta className="mb-2.5">Codice per gli atleti</Etichetta>
      <Pannello className="pad-pannello-stretto">
        {codice ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-[8rem] flex-1 select-all rounded-lg bg-pannello/12 px-3 py-2.5 font-mono text-[18px] font-bold tracking-[0.22em]">
                {codice.code}
              </code>
              <Pulsante
                className="py-2.5 text-[12px]"
                onClick={async () => {
                  // L'indirizzo e' quello da cui sta usando l'app: se un domani cambia dominio,
                  // il messaggio segue senza che nessuno lo debba ricordare.
                  const indirizzo = typeof window !== 'undefined' ? window.location.origin : '';
                  const testo = messaggioDaMandare(codice.code, settore.name, (state.teamProfile || {}).name, indirizzo);
                  try { await navigator.clipboard.writeText(testo); avvisa('Messaggio copiato: incollalo nel gruppo'); }
                  catch (e) { avvisa('Copialo a mano: ' + codice.code); }
                }}
              >
                Copia il messaggio
              </Pulsante>
              <Pulsante variante="nudo" className="py-2.5 text-[12px]" onClick={() => setDaRevocare(codice)}>
                Revoca
              </Pulsante>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-tenue">
              <Stato tono="buono">{postiRimasti(codice)} posti</Stato>
              {codice.expires_at && <span>scade il {fmtData(codice.expires_at)}</span>}
              {codice.uses > 0 && <span>· usato {codice.uses === 1 ? 'una volta' : codice.uses + ' volte'}</span>}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-tenue">
              Chi lo usa entra come atleta di {settore.name || 'questa categoria'} e aspetta che tu lo
              confermi: un codice mandato in un gruppo si gira, e chi l’ha usato lo riconosci tu.
              Non dà nessun potere sulla categoria.
            </p>
          </>
        ) : (
          <>
            <p className="text-[12.5px] leading-relaxed text-soffuso">
              Un codice solo da mandare nel gruppo di {settore.name || 'questa categoria'}: chi lo usa
              entra come <b className="text-testo">atleta di questa categoria</b> e finisce qui sopra,
              in attesa che tu lo confermi e lo colleghi alla sua scheda.
            </p>
            <Pulsante
              variante="primario"
              className="mt-3 w-full py-2.5 text-[13px]"
              onClick={async () => {
                if (inCampione()) { avvisa('Nell’anteprima con dati di esempio non si salva niente.'); return; }
                setLavora(true);
                try {
                  await createInvite({
                    role: 'atleta',
                    sectorIds: [sectorId],
                    label: 'Atleti ' + (settore.name || ''),
                    daysValid: GIORNI_PREDEFINITI,
                    maxUses: POSTI_PREDEFINITI
                  });
                  carica();
                  avvisa('Codice creato');
                } catch (e) {
                  avvisa((e && e.message) || 'Non è stato possibile creare il codice.');
                } finally {
                  setLavora(false);
                }
              }}
            >
              {lavora ? 'Creo…' : 'Crea il codice'}
            </Pulsante>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-tenue">
              Vale {POSTI_PREDEFINITI} persone e scade fra {GIORNI_PREDEFINITI} giorni. Il codice
              società, invece, vale per tutti e non scade: con questo il ruolo e la categoria sono già
              decisi, e non li sceglie chi si iscrive.
            </p>
          </>
        )}
      </Pannello>

      {daRevocare && (
        <Conferma
          titolo="Revocare il codice?"
          testo={
            'Il codice ' + daRevocare.code + ' smette di funzionare: chi l’ha ricevuto e non l’ha '
            + 'ancora usato non entrerà più. Chi è già entrato resta dov’è. Potrai farne un altro.'
          }
          etichetta="Revoca"
          onChiudi={() => setDaRevocare(null)}
          onConferma={async () => {
            await revokeInvite(daRevocare.id);
            carica();
            avvisa('Codice revocato');
          }}
        />
      )}

      {scelto && (
        <ModuloIscritto
          iscritto={scelto}
          onChiudi={() => setScelto(null)}
          onFatto={(testo) => {
            setAttesa(x => x.filter(y => y.id !== scelto.id));
            avvisa(testo);
          }}
        />
      )}
    </div>
  );
}
