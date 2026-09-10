import React, { useEffect, useState } from 'react';
import { state } from '../state.js';
import { detectIssues, todayISO } from '../utils/issues.js';
import {
  fetchAllPlayers, fetchAllPlayerDocuments, fetchOpenDeadlines,
  fetchOpenCommunications, fetchTrainingsInRange
} from '../api/dashboard.js';
import { fetchAttendanceForTrainings } from '../api/attendance.js';
import { inCampione } from './campione.js';
import { Pannello, Etichetta, Titolo, Vuoto, Scheletro, Stato, cx } from './ui.jsx';
import { ErroreCaricamento } from './moduli.jsx';
import { Chevron } from './icone.jsx';

/* La situazione della società.
 *
 * In alto una casella per CATEGORIA con quanto c'è da sistemare: è la domanda
 * che si fa per prima ("dove sto messo male?"), e toccandola si guarda solo
 * quella. Quello che non appartiene a nessuna categoria — sponsor, movimenti
 * non legati a un atleta, palestre contese fra due squadre — sta sotto
 * «Società».
 *
 * Sotto, le voci si raggruppano per TIPO di problema, e ogni gruppo è una
 * tabella di chi e cosa manca. Prima ogni riga ripeteva la frase del gruppo
 * ("16 atleti non hanno nessun certificato caricato") accanto a ciascun atleta:
 * sedici volte la stessa cosa, e nessuna che dicesse cosa mancasse a QUEL
 * ragazzo. La frase si dice una volta, in cima al gruppo; le righe dicono i
 * nomi.
 *
 * Ogni gruppo porta alla sezione dove il problema si risolve: leggere un
 * elenco di cose da fare senza poterle fare è metà del lavoro.
 */

const GIORNI_INDIETRO = 30;
const GIORNI_AVANTI = 30;

function scostaISO(giorni) {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

const TONO = { critical: 'fermo', warning: 'attesa', info: 'neutro' };
const FILO = { critical: 'bg-rosso', warning: 'bg-ambra', info: 'bg-blu' };
const PUNTO = { critical: 'bg-rosso', warning: 'bg-ambra', info: 'bg-blu' };

const SOCIETA = '__societa__';

function nomeCategoria(sectorId) {
  if (!sectorId) return 'Società';
  const s = state.sectors.find(x => x.id === sectorId);
  return s ? s.name : 'Società';
}

/* --------------------------------------------------------------- le caselle */
// Una per categoria, con quanto c'e' da sistemare. Non sono decorazione: sono
// il filtro. Toccarne una lascia sotto solo i suoi problemi, toccarla di nuovo
// rimette tutto.
function Casella({ nome, totale, critici, attiva, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={attiva}
      className={cx(
        'pad-pannello-stretto rounded-lg orlo text-left transition-all duration-200',
        attiva ? 'vetro-alto shadow-lg ring-1 ring-blu' : 'vetro shadow hover:bg-pannello/8'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Etichetta className="truncate">{nome}</Etichetta>
        <Chevron
          dim={14}
          className={cx('shrink-0 transition-transform duration-200', attiva ? 'rotate-90 text-blu' : 'text-tenue')}
        />
      </div>
      <div
        className={cx(
          'cifra mt-3 text-[30px] font-bold leading-none tracking-tight',
          critici ? 'text-rosso' : 'text-testo'
        )}
      >
        {totale}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-tenue">
        {critici ? critici + ' da risolvere subito' : 'niente di urgente'}
      </div>
    </button>
  );
}

/* Il contatto, cliccabile: un numero si chiama, non si trascrive. Il clic non
 * deve portare anche alla sezione, quindi si ferma qui. */
function Contatto({ valore }) {
  if (!valore) return <span className="text-tenue">—</span>;
  const telefono = /^[+\d][\d\s.\-()]{5,}$/.test(valore.trim());
  return (
    <a
      href={(telefono ? 'tel:' : 'mailto:') + valore.replace(/\s/g, '')}
      onClick={e => e.stopPropagation()}
      className={cx('transition-opacity hover:opacity-75', telefono ? 'cifra text-blu' : 'text-blu')}
    >
      {valore}
    </a>
  );
}

/* ----------------------------------------------------------- un tipo di guaio */
// La frase del gruppo compare qui, una volta. Le righe sotto dicono chi e cosa.
function Gruppo({ problema, mostraCategoria, onSezione }) {
  const vai = problema.action ? () => onSezione(problema.action.tab) : null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx('h-2 w-2 shrink-0 rounded-full', PUNTO[problema.severity] || 'bg-blu')} />
          <Etichetta className="truncate">{problema.title}</Etichetta>
          <Stato tono={TONO[problema.severity] || 'neutro'}>{problema.items.length}</Stato>
        </div>
        {vai && (
          <button
            onClick={vai}
            className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-blu transition-opacity hover:opacity-75"
          >
            {problema.action.label}
            <Chevron dim={13} />
          </button>
        )}
      </div>

      {problema.summary && (
        <p className="text-[12px] leading-relaxed text-tenue">{problema.summary}</p>
      )}

      {/* ------------------------------------------------ da tablet in su */}
      <Pannello className="hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-bordo/10">
              <th className="etichetta px-5 py-3">Chi</th>
              <th className="etichetta px-5 py-3">Cosa manca</th>
              <th className="etichetta w-48 px-5 py-3">Contatto</th>
              {mostraCategoria && <th className="etichetta w-44 px-5 py-3">Categoria</th>}
            </tr>
          </thead>
          <tbody>
            {problema.items.map((v, i) => (
              <tr
                key={i}
                onClick={vai || undefined}
                className={cx(
                  'border-b border-bordo/6 transition-colors last:border-b-0',
                  vai && 'cursor-pointer hover:bg-pannello/8'
                )}
              >
                <td className="px-5 py-3 text-[13.5px] font-semibold">{v.label}</td>
                <td className="px-5 py-3 text-[12.5px] leading-snug text-soffuso">{v.sub || '—'}</td>
                <td className="px-5 py-3 text-[12.5px]"><Contatto valore={v.contatto} /></td>
                {mostraCategoria && (
                  <td className="px-5 py-3 text-[12px] text-tenue">{nomeCategoria(v.sectorId)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Pannello>

      {/* --------------------------------------------------- su telefono */}
      <Pannello className="overflow-hidden md:hidden">
        {problema.items.map((v, i) => (
          <div
            key={i}
            onClick={vai || undefined}
            className={cx(
              'relative flex items-start gap-3 px-4 py-3',
              i > 0 && 'border-t border-bordo/6',
              vai && 'cursor-pointer'
            )}
          >
            <span className={cx('absolute inset-y-0 left-0 w-0.5', FILO[problema.severity] || 'bg-blu')} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold leading-tight">{v.label}</div>
              {v.sub && <div className="mt-1 text-[12px] leading-snug text-tenue">{v.sub}</div>}
              {v.contatto && (
                <div className="mt-1 text-[12px]"><Contatto valore={v.contatto} /></div>
              )}
            </div>
            {mostraCategoria && (
              <span className="shrink-0 text-[11px] text-tenue">{nomeCategoria(v.sectorId)}</span>
            )}
          </div>
        ))}
      </Pannello>
    </div>
  );
}

export function Situazione({ onSezione }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);
  const [filtro, setFiltro] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (inCampione()) { setDati({ issues: [], finanzaBloccata: false }); return; }

    (async () => {
      const teamId = state.teamProfile.id;
      const hasFinance = !!state.currentUser.finance_role;
      try {
        const [players, documents, communications, trainings] = await Promise.all([
          fetchAllPlayers(teamId),
          fetchAllPlayerDocuments(teamId),
          fetchOpenCommunications(teamId),
          fetchTrainingsInRange(teamId, scostaISO(-GIORNI_INDIETRO), scostaISO(GIORNI_AVANTI))
        ]);
        const attendance = await fetchAttendanceForTrainings(trainings.map(t => t.id));

        // La finanza ha autorizzazioni proprie e piu' fini dei ruoli: se non
        // passano, tutti gli altri controlli restano validi e vanno mostrati.
        let deadlines = [];
        let finanzaBloccata = false;
        if (hasFinance) {
          try { deadlines = await fetchOpenDeadlines(teamId); }
          catch (e) { finanzaBloccata = true; }
        }

        if (!vivo) return;
        setDati({
          issues: detectIssues({
            today: todayISO(), players, documents, deadlines, communications,
            trainings, attendance, sponsors: state.financeSponsors,
            sectors: state.sectors, hasFinance
          }),
          finanzaBloccata
        });
      } catch (e) {
        if (vivo) setErrore(e);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (errore) return <ErroreCaricamento cosa="la situazione della società" errore={errore} />;

  if (!dati) {
    return (
      <div className="sezioni">
        <Titolo sopra="Società">Situazione</Titolo>
        <Scheletro righe={4} />
      </div>
    );
  }

  // Quanto pesa ogni categoria: serve alle caselle in alto, e si conta una
  // volta sola su tutte le voci.
  const conti = new Map();
  dati.issues.forEach(problema => {
    (problema.items || []).forEach(voce => {
      const k = voce.sectorId || SOCIETA;
      const r = conti.get(k) || { totale: 0, critici: 0 };
      r.totale += 1;
      if (problema.severity === 'critical') r.critici += 1;
      conti.set(k, r);
    });
  });

  const categorie = [
    ...state.sectors.map(x => ({ id: x.id, nome: x.name })),
    { id: SOCIETA, nome: 'Società' }
  ]
    .filter(g => conti.has(g.id))
    .map(g => ({ ...g, ...conti.get(g.id) }));

  // Il filtro non sopravvive alla categoria che sparisce: se l'ultimo problema
  // di quel gruppo viene risolto, la pagina resterebbe vuota senza motivo.
  const filtroValido = filtro && conti.has(filtro) ? filtro : null;

  const visibili = dati.issues
    .map(problema => ({
      ...problema,
      items: (problema.items || []).filter(
        v => !filtroValido || (v.sectorId || SOCIETA) === filtroValido
      )
    }))
    .filter(problema => problema.items.length > 0);

  const totale = dati.issues.reduce((n, i) => n + (i.items || []).length, 0);

  return (
    <div className="sezioni">
      <Titolo
        sopra="Società"
        azione={totale > 0
          ? <span className="shrink-0 text-[12.5px] text-tenue">{totale} da sistemare</span>
          : null}
      >
        Situazione
      </Titolo>

      {categorie.length > 0 && (
        <div className="grid grid-cols-2 schede lg:grid-cols-4">
          {categorie.map(g => (
            <Casella
              key={g.id}
              nome={g.nome}
              totale={g.totale}
              critici={g.critici}
              attiva={filtroValido === g.id}
              onClick={() => setFiltro(filtroValido === g.id ? null : g.id)}
            />
          ))}
        </div>
      )}

      {filtroValido && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-tenue">
          <span>
            Stai guardando solo <b className="text-testo">{nomeCategoria(filtroValido === SOCIETA ? null : filtroValido)}</b>.
          </span>
          <button onClick={() => setFiltro(null)} className="font-semibold text-blu transition-opacity hover:opacity-75">
            Mostra tutte
          </button>
        </div>
      )}

      {dati.finanzaBloccata && (
        <Pannello className="pad-pannello-stretto">
          <p className="text-[12.5px] leading-relaxed text-ambra">
            Le scadenze economiche non sono state lette: il tuo accesso alla finanza non le comprende.
            Tutto il resto qui sotto è completo.
          </p>
        </Pannello>
      )}

      {totale === 0 ? (
        <Vuoto>
          Niente da sistemare. Certificati, tesseramenti, convocazioni, presenze e scadenze
          risultano tutti a posto.
        </Vuoto>
      ) : (
        visibili.map(problema => (
          <Gruppo
            key={problema.id}
            problema={problema}
            mostraCategoria={!filtroValido}
            onSezione={onSezione}
          />
        ))
      )}
    </div>
  );
}
